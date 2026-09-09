import { Ability, AbilityBuilder, AbilityClass } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PricingPlansService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing-plans.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import dayjs from 'dayjs';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { PaymentGatewaySettingsService } from '@gitroom/nestjs-libraries/database/prisma/settings/payment-gateway-settings.service';
import { AuthorizationActions, Sections } from './permission.exception.class';

export type AppAbility = Ability<[AuthorizationActions, Sections]>;

@Injectable()
export class PermissionsService {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _postsService: PostsService,
    private _integrationService: IntegrationService,
    private _webhooksService: WebhooksService,
    private _pricingPlansService: PricingPlansService,
    private _paymentGatewaySettingsService: PaymentGatewaySettingsService
  ) {}
  // `isSuperAdmin` (the site-wide admin flag, not an org role) exempts the
  // deployment's own admin accounts from billing enforcement - see
  // PermissionsService.check's doc comment for why this exemption exists.
  async getPackageOptions(orgId: string, isSuperAdmin = false) {
    const subscription =
      await this._subscriptionService.getSubscriptionByOrganizationId(orgId);

    // See PaymentGatewaySettingsService.isBillingEnforced's doc comment -
    // replaces the old `!process.env.STRIPE_PUBLISHABLE_KEY` billing-off
    // proxy that misfired on a RazorPay-configured deployment.
    const billingEnforced =
      (await this._paymentGatewaySettingsService.isBillingEnforced()) &&
      !isSuperAdmin;
    const tier = subscription?.subscriptionTier || (!billingEnforced ? 'PRO' : 'FREE');

    const pricing = await this._pricingPlansService.getPricingMap();
    const { channel, ...all } = pricing[tier];
    return {
      subscription,
      options: {
        ...all,
        ...{ channel: tier === 'FREE' ? channel : -10 },
      },
    };
  }

  // `isSuperAdmin` exempts the deployment's own admin accounts from billing
  // enforcement entirely (unlimited channels/posts/etc, same as an unbilled
  // install) - without this, an admin account with no real subscription
  // record would be blocked by the same limits as any other FREE-tier user,
  // since isSuperAdmin was previously only ever checked for admin-route
  // access, never for billing/tier.
  async check(
    orgId: string,
    created_at: Date,
    permission: 'USER' | 'ADMIN' | 'SUPERADMIN',
    requestedPermission: Array<[AuthorizationActions, Sections]>,
    refreshChannelId?: string,
    isSuperAdmin = false
  ) {
    const { can, build } = new AbilityBuilder<
      Ability<[AuthorizationActions, Sections]>
    >(Ability as AbilityClass<AppAbility>);

    const billingEnforced =
      (await this._paymentGatewaySettingsService.isBillingEnforced()) &&
      !isSuperAdmin;
    if (requestedPermission.length === 0 || !billingEnforced) {
      for (const [action, section] of requestedPermission) {
        can(action, section);
      }
      return build({
        detectSubjectType: (item) =>
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          item.constructor,
      });
    }

    const { subscription, options } = await this.getPackageOptions(
      orgId,
      isSuperAdmin
    );
    for (const [action, section] of requestedPermission) {
      // check for the amount of channels
      if (section === Sections.CHANNEL) {
        // Refreshing an existing channel doesn't add a new one, so skip the limit check
        // but only if the channel actually belongs to this org
        if (refreshChannelId) {
          const existingIntegration =
            await this._integrationService.getIntegrationById(
              orgId,
              refreshChannelId
            );
          if (existingIntegration) {
            can(action, section);
            continue;
          }
        }

        const totalChannels = (
          await this._integrationService.getIntegrationsList(orgId)
        ).filter((f) => !f.refreshNeeded).length;

        if (
          (options.channel && options.channel > totalChannels) ||
          (subscription?.totalChannels || 0) > totalChannels
        ) {
          can(action, section);
          continue;
        }
      }

      if (section === Sections.WEBHOOKS) {
        const totalWebhooks = await this._webhooksService.getTotal(orgId);
        if (totalWebhooks < options.webhooks) {
          can(AuthorizationActions.Create, section);
          continue;
        }
      }

      // check for posts per month
      if (section === Sections.POSTS_PER_MONTH) {
        const createdAt =
          (await this._subscriptionService.getSubscription(orgId))?.createdAt ||
          created_at;
        const totalMonthPast = Math.abs(
          dayjs(createdAt).diff(dayjs(), 'month')
        );
        const checkFrom = dayjs(createdAt).add(totalMonthPast, 'month');
        const count = await this._postsService.countPostsFromDay(
          orgId,
          checkFrom.toDate()
        );

        if (count < options.posts_per_month) {
          can(action, section);
          continue;
        }
      }

      if (section === Sections.TEAM_MEMBERS && options.team_members) {
        can(action, section);
        continue;
      }

      if (
        section === Sections.ADMIN &&
        ['ADMIN', 'SUPERADMIN'].includes(permission)
      ) {
        can(action, section);
        continue;
      }

      if (
        section === Sections.COMMUNITY_FEATURES &&
        options.community_features
      ) {
        can(action, section);
        continue;
      }

      if (
        section === Sections.FEATURED_BY_GITROOM &&
        options.featured_by_gitroom
      ) {
        can(action, section);
        continue;
      }

      if (section === Sections.AI && options.ai) {
        can(action, section);
        continue;
      }

      if (
        section === Sections.IMPORT_FROM_CHANNELS &&
        options.import_from_channels
      ) {
        can(action, section);
      }
    }

    return build({
      detectSubjectType: (item) =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        item.constructor,
    });
  }
}
