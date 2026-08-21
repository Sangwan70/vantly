import { google } from 'googleapis';
import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';

const defaultRedirect = () =>
  `${process.env.FRONTEND_URL}/integrations/social/youtube`;

const makeClient = (redirectUri: string) =>
  new google.auth.OAuth2({
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
  });

@AuthProvider({ provider: 'GOOGLE' })
export class GoogleProvider extends AuthProviderAbstract {
  generateLink(query?: { redirect_uri?: string }) {
    const redirectUri = query?.redirect_uri || defaultRedirect();
    return makeClient(redirectUri).generateAuthUrl({
      access_type: 'online',
      // This is the "Sign in with Google" LOGIN provider (see
      // auth.controller.ts's /auth/oauth/GOOGLE, resolved via
      // AuthProviderManager's 'GOOGLE' key) - not the separate YouTube
      // channel-connect provider in
      // integrations/social/youtube.provider.ts. `prompt: 'consent'`
      // forces Google's full consent screen on every single login
      // attempt, even for a user who already granted these same two
      // basic scopes (profile/email) minutes earlier - that's what was
      // showing up as "the token isn't preserved, it sends me back to
      // Google's login page again". `select_account` still lets a user
      // with multiple Google accounts choose which one, but skips the
      // forced re-consent for a scope set Google already approved.
      prompt: 'select_account',
      state: 'login',
      redirect_uri: redirectUri,
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
  }

  async getToken(code: string, redirectUri?: string) {
    const client = makeClient(redirectUri || defaultRedirect());
    const { tokens } = await client.getToken(code);
    return tokens.access_token!;
  }

  async getUser(providerToken: string) {
    const client = makeClient(defaultRedirect());
    client.setCredentials({ access_token: providerToken });
    const { data } = await google
      .oauth2({ version: 'v2', auth: client })
      .userinfo.get();

    return {
      id: data.id!,
      email: data.email!,
    };
  }
}
