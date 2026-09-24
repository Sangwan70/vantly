import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { SkillpediaDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/skillpedia.dto';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

// Same shape/trick as WordpressProvider: the "access token" this app stores
// is a base64-encoded JSON blob (built client-side from the connect-form
// customFields below), decoded back out on every call rather than a real
// OAuth token - because theskillpedia's REST API is key-based, not OAuth.
type SkillpediaCredentials = {
  domain: string;
  key_id: string;
  key_secret: string;
};

function decodeCredentials(accessToken: string): SkillpediaCredentials {
  const body = JSON.parse(
    Buffer.from(accessToken, 'base64').toString()
  ) as SkillpediaCredentials;
  // Users often paste the domain with surrounding whitespace or a trailing
  // slash, which would otherwise build "https://site.com//api/v1/...".
  return { ...body, domain: body.domain.trim().replace(/\/+$/, '') };
}

function authHeader(creds: SkillpediaCredentials): string {
  return `Bearer ${creds.key_id}.${creds.key_secret}`;
}

export class SkillpediaProvider
  extends SocialAbstract
  implements SocialProvider
{
  identifier = 'skillpedia';
  name = 'The SkillPedia';
  isBetweenSteps = false;
  editor = 'html' as const;
  scopes = [] as string[];
  dto = SkillpediaDto;
  maxLength() {
    return 100000;
  }

  async generateAuthUrl() {
    const state = makeId(6);
    return {
      url: state,
      codeVerifier: makeId(10),
      state,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async customFields() {
    return [
      {
        key: 'domain',
        label: 'theSkillPedia URL',
        validation: `/^https?:\\/\\/(?:www\\.)?[\\w\\-]+(\\.[\\w\\-]+)+([\\/?#][^\\s]*)?$/`,
        type: 'text' as const,
      },
      {
        key: 'key_id',
        label: 'API Key ID',
        validation: `/.+/`,
        type: 'text' as const,
        hint: 'Generate in theSkillPedia under Settings > API Keys',
      },
      {
        key: 'key_secret',
        label: 'API Key Secret',
        validation: `/.+/`,
        type: 'password' as const,
        hint: 'Shown once when the key is generated or rotated',
      },
    ];
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const creds = decodeCredentials(params.code);

    let response: Response;
    try {
      response = await fetch(`${creds.domain}/api/v1/me`, {
        headers: { Authorization: authHeader(creds) },
        // @ts-ignore - undici-only option; blocks SSRF to internal IPs
        dispatcher: getSsrfSafeDispatcher(),
      });
    } catch (err) {
      console.log(err);
      return 'Could not reach your theSkillPedia site. Check the URL and that the site is publicly accessible.';
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log(
        `theSkillPedia auth failed for ${creds.domain} (HTTP ${response.status})`,
        errorBody.slice(0, 500)
      );

      if (response.status === 401 || response.status === 403) {
        return 'theSkillPedia rejected this API key. Check the Key ID and Key Secret, and that the key has not been revoked.';
      }

      return `theSkillPedia returned an unexpected error (HTTP ${response.status}).`;
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch (err) {
      console.log(err);
      return 'theSkillPedia did not return a valid response.';
    }

    const user = payload?.data;
    if (!payload?.success || !user?.id) {
      return 'theSkillPedia did not recognize this API key.';
    }

    return {
      refreshToken: '',
      // Key secrets are rotated on theSkillPedia's side, not by this app -
      // same "never really expires" convention as WordpressProvider's
      // Application Password token.
      expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
      accessToken: params.code,
      id: creds.domain + '_' + user.id,
      name: user.name,
      picture: '',
      username: user.email || user.name,
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<SkillpediaDto>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const creds = decodeCredentials(accessToken);

    // Feature image: theSkillPedia's API is a two-step upload (POST
    // /api/v1/media -> Media id, then that id as `feature_image` on the
    // post itself) rather than accepting a raw file directly on the post
    // endpoint - see MediaService/MediaController on the theSkillPedia
    // side. Mirrors WordpressProvider's own image-then-post two-step,
    // just with a multipart form instead of a raw-binary body, since
    // that's what the Laravel endpoint expects.
    let featureImageId: number | undefined;
    const imagePath = postDetails?.[0]?.settings?.main_image?.path;
    if (imagePath) {
      try {
        const blob = await this.fetch(imagePath).then((r) => r.blob());
        const filename = imagePath.split('/').pop()?.split('?')[0] || 'image';

        const form = new FormData();
        form.append('file', blob, filename);

        const mediaResponse = await (
          await this.fetch(`${creds.domain}/api/v1/media`, {
            method: 'POST',
            headers: {
              Authorization: authHeader(creds),
              Accept: 'application/json',
            },
            body: form,
          })
        ).json();

        if (mediaResponse?.success && mediaResponse?.data?.id) {
          featureImageId = mediaResponse.data.id;
        } else {
          console.log('theSkillPedia media upload failed', mediaResponse);
        }
      } catch (err) {
        // A failed image upload shouldn't block publishing the post text -
        // same tradeoff WordpressProvider makes (no try/catch there either
        // stops the post, a bad media response just leaves featured_media
        // unset).
        console.log('theSkillPedia media upload error', err);
      }
    }

    const submit = await (
      await this.fetch(`${creds.domain}/api/v1/posts`, {
        method: 'POST',
        headers: {
          Authorization: authHeader(creds),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: postDetails?.[0]?.settings?.title,
          post_content: postDetails?.[0]?.message,
          ...(featureImageId ? { feature_image: featureImageId } : {}),
        }),
      })
    ).json();

    return [
      {
        id: postDetails?.[0].id,
        status: 'completed',
        postId: String(submit?.data?.id),
        releaseURL: submit?.data?.url,
      },
    ];
  }
}
