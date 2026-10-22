export interface JwtPayload {
  sub: number;
  jti: string;
  exp?: number;
}
