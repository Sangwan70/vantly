import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { TrackService } from '@gitroom/nestjs-libraries/track/track.service';
import { RealIP } from 'nestjs-real-ip';
import { UserAgent } from '@gitroom/nestjs-libraries/user/user.agent';
import { TrackEnum } from '@gitroom/nestjs-libraries/user/track.enum';
import { Request, Response } from 'express';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { AgentGraphInsertService } from '@gitroom/nestjs-libraries/agent/agent.graph.insert.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PaymentGatewaySettingsService } from '@gitroom/nestjs-libraries/database/prisma/settings/payment-gateway-settings.service';
import { BlogService } from '@gitroom/nestjs-libraries/database/prisma/content/blog.service';
import { StaticPagesService } from '@gitroom/nestjs-libraries/database/prisma/content/static-pages.service';
import { PricingPlansService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing-plans.service';
import { EmailSuppressionService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-suppression.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { OnlyURL } from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

const pump = promisify(pipeline);

@ApiTags('Public')
@Controller('/public')
export class PublicController {
  constructor(
    private _trackService: TrackService,
    private _agentGraphInsertService: AgentGraphInsertService,
    private _postsService: PostsService,
    private _subscriptionService: SubscriptionService,
    private _paymentGatewaySettingsService: PaymentGatewaySettingsService,
    private _blogService: BlogService,
    private _staticPagesService: StaticPagesService,
    private _pricingPlansService: PricingPlansService,
    private _emailSuppressionService: EmailSuppressionService
  ) {}

  // Public blog listing - server-rendered first page and the client
  // "Load more" button both call this with the same offset/limit shape.
  @Get('/blog/posts')
  async listBlogPosts(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ) {
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 24) : undefined;
    return this._blogService.listPublished(
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
      Number.isFinite(parsedLimit) && (parsedLimit as number) > 0
        ? parsedLimit
        : undefined
    );
  }

  @Get('/blog/posts/:slug')
  async getBlogPost(@Param('slug') slug: string) {
    const post = await this._blogService.getPublishedBySlug(slug);
    if (!post) {
      throw new HttpException('Not found', 404);
    }
    return post;
  }

  // Admin override for a fixed marketing-page slug, or null if none was
  // ever set - callers fall back to their own hardcoded default copy.
  @Get('/static-pages/:slug')
  async getStaticPage(@Param('slug') slug: string) {
    return (await this._staticPagesService.getBySlug(slug)) || null;
  }

  // Public (no auth) so logged-out visitors on the pricing page, and the
  // (app) layout server component, always render checkout UI/prices for
  // whichever gateway is actually active - see billing.controller.ts's
  // isRazorpay() doc comment for why this is admin-configurable at runtime
  // and can't be baked in at build time. Response is a superset of the
  // original `{ activeGateway }` shape (additive fields only, so existing
  // callers reading just that one field are unaffected): also carries the
  // display currency (see resolveCurrencyDisplay's doc comment on why an
  // INR amount here is an estimate, never the real charge), RazorPay's
  // public key id (needed client-side to open Checkout.js), and whether
  // the active gateway actually has usable credentials right now.
  @Get('/billing/active-gateway')
  async getActivePaymentGateway() {
    return this._paymentGatewaySettingsService.resolvePublicBillingConfig();
  }

  // Live, DB-backed pricing map (Record<tier, PricingInnerInterface>,
  // same snake_case shape the app used to import statically from
  // subscriptions/pricing.ts) - public/no-auth so the authenticated
  // frontend's usePricingPlans() hook (which can't reach VariableContext-
  // gated data any earlier than this) and any future logged-out surface
  // can both read current tier prices/limits without a privileged
  // session. Never exposes admin-only fields like RazorPay Plan ids.
  @Get('/pricing-plans')
  async getPricingPlans() {
    return this._pricingPlansService.getPricingMap();
  }

  // Marketing-card-shaped plan list for the public /pricing page -
  // active, purchasable, non-FREE tiers only, ordered for display,
  // trimmed to the fields the pricing cards/comparison table actually
  // render (no internal admin metadata like updatedBy or gateway ids).
  // Replaces the old hand-maintained MARKETING_TIERS mirror in
  // marketing/pricing-tiers.ts, which had to be updated by hand every
  // time the real pricing.ts values changed.
  @Get('/pricing-plans/marketing')
  async getMarketingPricingPlans() {
    const rows = await this._pricingPlansService.listAllForAdmin();
    return rows
      .filter((row) => row.tier !== 'FREE' && row.isActive && row.isPurchasable)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => ({
        tier: row.tier,
        displayName: row.displayName,
        description: row.description,
        badge: row.badge,
        features: row.features,
        monthPrice: row.monthPrice,
        yearPrice: row.yearPrice,
        channel: row.channel,
        teamMembers: row.teamMembers,
        communityFeatures: row.communityFeatures,
        autoPost: row.autoPost,
        imageGenerationCount: row.imageGenerationCount,
        generateVideos: row.generateVideos,
        youtubeTextSuggestions: row.youtubeTextSuggestions,
        webhooks: row.webhooks,
        publicApi: row.publicApi,
      }));
  }

  // One-click unsubscribe link target embedded in every mailer campaign
  // footer (see EmailSuppressionService.buildUnsubscribeUrl) - public, no
  // auth, so it works directly from an email client.
  @Get('/mailer/unsubscribe')
  async unsubscribeFromMailer(@Query('token') token: string) {
    if (!token) {
      throw new HttpException('Missing token', 400);
    }
    const email = await this._emailSuppressionService.unsubscribeByToken(token);
    if (!email) {
      throw new HttpException('Invalid or expired unsubscribe link', 400);
    }
    return { success: true, email };
  }

  @Post('/agent')
  async createAgent(@Body() body: { text: string; apiKey: string }) {
    if (
      !body.apiKey ||
      !process.env.AGENT_API_KEY ||
      body.apiKey !== process.env.AGENT_API_KEY
    ) {
      return;
    }
    return this._agentGraphInsertService.newPost(body.text);
  }

  @Get(`/posts/:id`)
  async getPreview(@Param('id') id: string) {
    return (await this._postsService.getPostsRecursively(id, true)).map(
      ({ childrenPost, ...p }) => ({
        ...p,
        ...(p.integration
          ? {
              integration: {
                id: p.integration.id,
                name: p.integration.name,
                picture: p.integration.picture,
                providerIdentifier: p.integration.providerIdentifier,
                profile: p.integration.profile,
              },
            }
          : {}),
      })
    );
  }

  @Get(`/posts/:id/comments`)
  async getComments(@Param('id') postId: string) {
    return { comments: await this._postsService.getComments(postId) };
  }

  @Post('/t')
  async trackEvent(
    @Res() res: Response,
    @Req() req: Request,
    @RealIP() ip: string,
    @UserAgent() userAgent: string,
    @Body()
    body: { fbclid?: string; tt: TrackEnum; additional: Record<string, any> }
  ) {
    const uniqueId = req?.cookies?.track || makeId(10);
    const fbclid = req?.cookies?.fbclid || body.fbclid;
    await this._trackService.track(
      uniqueId,
      ip,
      userAgent,
      body.tt,
      body.additional,
      fbclid
    );
    if (!req.cookies.track) {
      res.cookie('track', uniqueId, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        ...(!process.env.NOT_SECURED
          ? {
              secure: true,
              httpOnly: true,
            }
          : {}),
        sameSite: 'none',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      });
    }

    if (body.fbclid && !req.cookies.fbclid) {
      res.cookie('fbclid', body.fbclid, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        ...(!process.env.NOT_SECURED
          ? {
              secure: true,
              httpOnly: true,
            }
          : {}),
        sameSite: 'none',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      });
    }

    res.status(200).json({
      track: uniqueId,
    });
  }

  @Post('/modify-subscription')
  async modifySubscription(@Body('params') params: string) {
    try {
      const load = AuthService.verifyJWT(params) as {
        orgId: string;
        billing: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';
      };

      const pricing = await this._pricingPlansService.getPricingMap();
      if (!load || !load.orgId || !load.billing || !pricing[load.billing]) {
        return { success: false };
      }

      const totalChannels = pricing[load.billing].channel || 0;

      await this._subscriptionService.modifySubscriptionByOrg(
        load.orgId,
        totalChannels,
        load.billing
      );

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }


  @Get('/stream')
  async streamFile(
    @Query() query: OnlyURL,
    @Res() res: Response,
    @Req() req: Request
  ) {
    const { url } = query;
    if (!url.endsWith('mp4')) {
      return res.status(400).send('Invalid video URL');
    }

    const ac = new AbortController();
    const onClose = () => ac.abort();
    req.on('aborted', onClose);
    res.on('close', onClose);

    // Manually follow redirects so every hop is re-validated against
    // the SSRF blocklist (see GHSA-34w8-5j2v-h6ww). `fetch` defaults to
    // `redirect: 'follow'`, which bypasses the DTO-level URL check.
    const MAX_REDIRECTS = 5;
    let currentUrl = url;
    let r: globalThis.Response | undefined;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isSafePublicHttpsUrl(currentUrl))) {
        return res.status(400).send('Blocked URL');
      }

      r = await fetch(currentUrl, {
        signal: ac.signal,
        redirect: 'manual',
        // @ts-ignore — undici option, not in lib.dom fetch types
        dispatcher: ssrfSafeDispatcher,
      });

      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get('location');
        if (!location) {
          return res.status(502).send('Redirect without Location');
        }
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch {
          return res.status(400).send('Invalid redirect target');
        }
        continue;
      }

      break;
    }

    if (!r) {
      return res.status(502).send('No upstream response');
    }

    if (r.status >= 300 && r.status < 400) {
      return res.status(508).send('Too many redirects');
    }

    if (!r.ok && r.status !== 206) {
      res.status(r.status);
      throw new Error(`Upstream error: ${r.statusText}`);
    }

    const type = r.headers.get('content-type') ?? 'application/octet-stream';
    res.setHeader('Content-Type', type);

    const contentRange = r.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    const len = r.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);

    const acceptRanges = r.headers.get('accept-ranges') ?? 'bytes';
    res.setHeader('Accept-Ranges', acceptRanges);

    if (r.status === 206) res.status(206); // Partial Content for range responses

    try {
      await pump(Readable.fromWeb(r.body as any), res);
    } catch (err) {}
  }
}
