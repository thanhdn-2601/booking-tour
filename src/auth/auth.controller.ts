import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenCookie } from './decorators/refresh-token-cookie.decorator';
import { ActivateQueryDto } from './dto/activate-query.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClearRefreshTokenCookieInterceptor } from './interceptors/clear-refresh-token-cookie.interceptor';
import { RefreshTokenCookieInterceptor } from './interceptors/refresh-token-cookie.interceptor';
import { ActivateResponse } from './interfaces/activate-response.interface';
import { LoginResult } from './interfaces/login-result.interface';
import { RegisterResponse } from './interfaces/register-response.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @UseInterceptors(RefreshTokenCookieInterceptor)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @ApiOperation({
    summary: 'Refresh the access token using the refresh token cookie',
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(RefreshTokenCookieInterceptor)
  refresh(
    @RefreshTokenCookie() currentRefreshToken: string | undefined,
  ): Promise<LoginResult> {
    return this.authService.refresh(currentRefreshToken);
  }

  @ApiOperation({ summary: 'Log out the current session' })
  @ApiSecurity('bearer')
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClearRefreshTokenCookieInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(
    @CurrentUser() user: User,
    @RefreshTokenCookie() refreshToken: string | undefined,
  ): Promise<void> {
    return this.authService.logout(user.id, refreshToken);
  }
}
