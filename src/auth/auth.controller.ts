import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';

import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { ActivateQueryDto } from './dto/activate-query.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ActivateResponse } from './interfaces/activate-response.interface';
import { LoginResponse } from './interfaces/login-response.interface';
import { RegisterResponse } from './interfaces/register-response.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Register a new account' })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Activate an account using its activation token' })
  @Get('activate')
  activate(@Query() query: ActivateQueryDto): Promise<ActivateResponse> {
    return this.authService.activate(query.token);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, refreshToken, refreshTokenExpiresAt } =
      await this.authService.login(dto);
    this.setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
    return response;
  }

  @ApiOperation({
    summary: 'Refresh the access token using the refresh token cookie',
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    const { response, refreshToken, refreshTokenExpiresAt } =
      await this.authService.refresh(currentRefreshToken);
    this.setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
    return response;
  }

  @ApiOperation({ summary: 'Log out the current session' })
  @ApiSecurity('bearer')
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    await this.authService.logout(user.id, refreshToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.refreshTokenCookieOptions());
  }

  private setRefreshTokenCookie(
    res: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.refreshTokenCookieOptions(),
      expires: expiresAt,
    });
  }

  private refreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
    };
  }
}
