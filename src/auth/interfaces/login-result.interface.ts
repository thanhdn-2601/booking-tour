import { LoginResponse } from './login-response.interface';

export interface LoginResult {
  response: LoginResponse;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
