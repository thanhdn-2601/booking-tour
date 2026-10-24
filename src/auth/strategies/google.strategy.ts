import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';
import { Profile, Strategy } from 'passport-google-oauth20';

import { GOOGLE_SCOPES, GOOGLE_STRATEGY } from '../auth.constants';
import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import { OAuthProvider } from '../oauth-provider.enum';

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  GOOGLE_STRATEGY,
) {
  constructor(
    configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: GOOGLE_SCOPES,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): OAuthProfile {
    const email = profile.emails?.find((item) => item.verified)?.value;
    if (!email) {
      throw new UnauthorizedException({
        code: 'OAUTH_EMAIL_REQUIRED',
        message: this.i18n.t('auth.oauth_email_required'),
      });
    }

    return {
      provider: OAuthProvider.GOOGLE,
      providerUserId: profile.id,
      email,
      fullName: profile.displayName || email,
    };
  }
}
