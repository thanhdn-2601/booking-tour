import { OAuthProvider } from '../oauth-provider.enum';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  fullName: string;
}
