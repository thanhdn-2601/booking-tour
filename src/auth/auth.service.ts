import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';

import { isUniqueViolation } from '../common/postgres-errors';
import { ACTIVATION_TOKEN_BYTES, REFRESH_TOKEN_BYTES } from './auth.constants';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { UserStatus } from '../users/user-status.enum';
import { UsersService } from '../users/users.service';
import { AuthIdentity } from './entities/auth-identity.entity';
import { UserAuthSession } from './entities/user-auth-session.entity';
import { ActivateResponse } from './interfaces/activate-response.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResult } from './interfaces/login-result.interface';
import { OAuthProfile } from './interfaces/oauth-profile.interface';
import { RegisterResponse } from './interfaces/register-response.interface';
import { SessionTokens } from './interfaces/session-tokens.interface';
import { PASSWORD_SALT_ROUNDS } from './password.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyPasswordHash: Promise<string> | undefined;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    @InjectRepository(UserAuthSession)
    private readonly sessionsRepository: Repository<UserAuthSession>,
    @InjectRepository(AuthIdentity)
    private readonly authIdentitiesRepository: Repository<AuthIdentity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const emailTaken = await this.usersService.existsByEmail(dto.email);
    if (emailTaken) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: this.i18n.t('auth.email_already_exists'),
      });
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      PASSWORD_SALT_ROUNDS,
    );
    const activationToken = randomBytes(ACTIVATION_TOKEN_BYTES).toString('hex');
    const ttlHours = this.configService.getOrThrow<number>(
      'ACTIVATION_TOKEN_TTL_HOURS',
    );
    const activationTokenExpiresAt = new Date(
      Date.now() + Number(ttlHours) * 60 * 60 * 1000,
    );

    let user: User;
    try {
      user = await this.usersService.create({
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        activationTokenHash: this.hashToken(activationToken),
        activationTokenExpiresAt,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: this.i18n.t('auth.email_already_exists'),
        });
      }
      throw error;
    }

    // No mail infrastructure yet — returned directly (non-production only) so
    // the activation flow is testable without reading server logs.
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      ...(isProduction ? {} : { activationToken }),
    };
  }

  async activate(token: string): Promise<ActivateResponse> {
    const activationTokenHash = this.hashToken(token);
    const user =
      await this.usersService.findByActivationTokenHash(activationTokenHash);
    if (!user) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: this.i18n.t('auth.token_invalid_or_expired'),
      });
    }
    if (
      !user.activationTokenExpiresAt ||
      user.activationTokenExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: this.i18n.t('auth.token_invalid_or_expired'),
      });
    }

    const activated = await this.usersService.activateIfPending(
      user.id,
      new Date(),
    );
    if (!activated) {
      throw new ConflictException({
        code: 'ALREADY_ACTIVATED',
        message: this.i18n.t('auth.already_activated'),
      });
    }

    return { status: 'ACTIVATED' };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.password ?? (await this.getDummyPasswordHash()),
    );
    if (!user || !user.password || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: this.i18n.t('auth.invalid_credentials'),
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: this.i18n.t('auth.user_inactive'),
      });
    }

    return this.issueTokens(user);
  }

  async loginWithGoogle(profile: OAuthProfile): Promise<LoginResult> {
    const user = await this.findOrCreateByOAuthProfile(profile);
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: this.i18n.t('auth.user_inactive'),
      });
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken?: string): Promise<LoginResult> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: this.i18n.t('auth.refresh_token_invalid'),
      });
    }

    const refreshTokenHash = this.hashToken(refreshToken);
    const session = await this.sessionsRepository.findOne({
      where: { refreshTokenHash },
      relations: { user: true },
      select: {
        id: true,
        expiresAt: true,
        user: { id: true, status: true },
      },
    });
    if (!session) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: this.i18n.t('auth.refresh_token_invalid'),
      });
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED_OR_EXPIRED',
        message: this.i18n.t('auth.session_revoked_or_expired'),
      });
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const claim = await manager.update(
        UserAuthSession,
        {
          id: session.id,
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        { revokedAt: new Date() },
      );
      if (!claim.affected) {
        return { kind: 'session-unusable' as const };
      }

      const user = session.user;
      if (user.status !== UserStatus.ACTIVE) {
        return { kind: 'user-inactive' as const };
      }

      return {
        kind: 'ok' as const,
        tokens: await this.issueTokens(user, manager),
      };
    });

    if (outcome.kind === 'session-unusable') {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED_OR_EXPIRED',
        message: this.i18n.t('auth.session_revoked_or_expired'),
      });
    }
    if (outcome.kind === 'user-inactive') {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: this.i18n.t('auth.user_inactive'),
      });
    }
    return outcome.tokens;
  }

  async logout(
    userId: number,
    accessToken: string | undefined,
    refreshToken: string | undefined,
  ): Promise<void> {
    if (accessToken) {
      const payload = this.jwtService.decode<JwtPayload>(accessToken);
      if (payload?.jti && payload.exp) {
        const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);
        try {
          await this.redisService.blacklistToken(payload.jti, ttlSeconds);
        } catch (error) {
          this.logger.error(
            `Failed to blacklist access token for user ${userId} on logout`,
            error instanceof Error ? error.stack : error,
          );
        }
      }
    }

    if (!refreshToken) return;
    const refreshTokenHash = this.hashToken(refreshToken);
    await this.sessionsRepository.update(
      { userId, refreshTokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllSessions(
    userId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const sessionsRepository = manager
      ? manager.getRepository(UserAuthSession)
      : this.sessionsRepository;
    await sessionsRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokens(
    user: User,
    manager?: EntityManager,
  ): Promise<LoginResult> {
    const expiresIn = this.configService.getOrThrow<number>(
      'JWT_ACCESS_TOKEN_TTL_SECONDS',
    );
    const payload: JwtPayload = { sub: user.id, jti: randomUUID() };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${expiresIn}s`,
    });

    const { refreshToken, refreshTokenExpiresAt } = await this.createSession(
      user,
      manager,
    );

    return {
      response: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: Number(expiresIn),
      },
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  private async createSession(
    user: User,
    manager?: EntityManager,
  ): Promise<SessionTokens> {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const ttlDays = this.configService.getOrThrow<number>(
      'REFRESH_TOKEN_TTL_DAYS',
    );
    const refreshTokenExpiresAt = new Date(
      Date.now() + Number(ttlDays) * 24 * 60 * 60 * 1000,
    );

    const sessionsRepository = manager
      ? manager.getRepository(UserAuthSession)
      : this.sessionsRepository;
    const session = sessionsRepository.create({
      userId: user.id,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });
    await sessionsRepository.save(session);

    return { refreshToken, refreshTokenExpiresAt };
  }

  private async findOrCreateByOAuthProfile(
    profile: OAuthProfile,
  ): Promise<User> {
    const linked = await this.findUserByOAuthIdentity(profile);
    if (linked) return linked;

    try {
      return await this.dataSource.transaction(async (manager) => {
        const email = profile.email.toLowerCase();
        const existing = await manager.findOne(User, {
          where: { email },
          select: { id: true, status: true },
        });
        const user =
          existing ??
          (await manager.save(
            manager.create(User, {
              email,
              fullName: profile.fullName,
              password: null,
              role: UserRole.USER,
              status: UserStatus.ACTIVE,
              emailVerifiedAt: new Date(),
            }),
          ));
        await manager.insert(AuthIdentity, {
          userId: user.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        });
        return user;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const user = await this.findUserByOAuthIdentity(profile);
      if (!user) throw error;
      return user;
    }
  }

  private async findUserByOAuthIdentity({
    provider,
    providerUserId,
  }: OAuthProfile): Promise<User | null> {
    const identity = await this.authIdentitiesRepository.findOne({
      where: { provider, providerUserId },
      relations: { user: true },
      select: { id: true, user: { id: true, status: true } },
    });
    return identity?.user ?? null;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= bcrypt.hash(
      randomBytes(32).toString('hex'),
      PASSWORD_SALT_ROUNDS,
    );
    return this.dummyPasswordHash;
  }
}
