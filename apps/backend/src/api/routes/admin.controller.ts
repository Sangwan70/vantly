import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { ErrorsService } from '@gitroom/nestjs-libraries/database/prisma/errors/errors.service';
import { AdminStatsService } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { PaymentGatewaySettingsService } from '@gitroom/nestjs-libraries/database/prisma/settings/payment-gateway-settings.service';
import { PaymentGatewaySettingsDto } from '@gitroom/nestjs-libraries/dtos/settings/payment-gateway-settings.dto';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PricingPlansService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing-plans.service';
import { AdminUpdateUserDto } from '@gitroom/nestjs-libraries/dtos/users/admin.update.user.dto';
import { AdminGrantSubscriptionDto } from '@gitroom/nestjs-libraries/dtos/billing/admin.grant.subscription.dto';
import dayjs from 'dayjs';

@ApiTags('Admin')
@Controller('/admin')
export class AdminController {
  constructor(
    private _errorsService: ErrorsService,
    private _adminStatsService: AdminStatsService,
    private _usersService: UsersService,
    private _paymentGatewaySettingsService: PaymentGatewaySettingsService,
    private _subscriptionService: SubscriptionService,
    private _pricingPlansService: PricingPlansService
  ) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  // Users grid: paginated, searchable, filterable. page is 0-based, same
  // convention as /admin/errors.
  @Get('/users')
  async listUsers(
    @GetUserFromRequest() user: User,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string
  ) {
    this.assertSuperAdmin(user);

    const size = Math.min(Math.max(parseInt(pageSize || '25', 10) || 25, 1), 100);
    const pageNum = Math.max(parseInt(page || '0', 10) || 0, 0);

    return this._usersService.adminListUsers({
      search: search?.trim() || undefined,
      page: pageNum,
      pageSize: size,
      status: status === 'active' || status === 'banned' ? status : 'all',
      tier: tier || 'ALL',
      sort: sort || 'lastOnline',
      dir: dir === 'asc' ? 'asc' : 'desc',
    });
  }

  @Get('/users/:id')
  async getUser(@GetUserFromRequest() user: User, @Param('id') id: string) {
    this.assertSuperAdmin(user);
    const found = await this._usersService.adminGetUser(id);
    if (!found) {
      throw new HttpException('User not found', 404);
    }
    return found;
  }

  @Put('/users/:id')
  async updateUser(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: AdminUpdateUserDto
  ) {
    this.assertSuperAdmin(user);
    const result = await this._usersService.adminUpdateUser(id, body);
    if (result === 'not_found') {
      throw new HttpException('User not found', 404);
    }
    if (result === 'email_taken') {
      throw new HttpException(
        'Another account with this email already exists',
        400
      );
    }
    return { success: true };
  }

  // Complimentary plan grant for one of the user's organizations. Reuses
  // SubscriptionService.adminSetSubscription (the same path as
  // /billing/admin-set-subscription) so tier-change side effects - trimming
  // channels over the new limit, toggling team-member access - still run.
  @Post('/users/:id/subscription')
  async grantSubscription(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: AdminGrantSubscriptionDto
  ) {
    this.assertSuperAdmin(user);

    if (!(await this._usersService.adminUserBelongsToOrg(id, body.organizationId))) {
      throw new HttpException('User is not a member of that organization', 400);
    }

    let totalChannels = body.totalChannels;
    if (totalChannels === undefined && body.tier !== 'FREE') {
      const pricing = await this._pricingPlansService.getPricingMap();
      totalChannels = pricing[body.tier]?.channel ?? 0;
    }

    await this._subscriptionService.adminSetSubscription(body.organizationId, {
      tier: body.tier,
      totalChannels: totalChannels ?? 0,
      period: body.period,
      isLifetime: !!body.isLifetime,
    });

    return { success: true };
  }

  @Post('/users/:id/ban')
  async banUser(@GetUserFromRequest() user: User, @Param('id') id: string) {
    this.assertSuperAdmin(user);
    if (user.id === id) {
      throw new HttpException('You cannot ban your own account', 400);
    }

    await this._usersService.banUser(id);
    return { banned: true };
  }

  @Post('/users/:id/unban')
  async unbanUser(@GetUserFromRequest() user: User, @Param('id') id: string) {
    this.assertSuperAdmin(user);
    await this._usersService.unbanUser(id);
    return { banned: false };
  }

  // Which gateway new subscriptions use, and whether that's an explicit
  // admin override or the PAYMENT_GATEWAY env var / built-in default
  // (razorpay). See payment-gateway-settings.service.ts's doc comment for
  // why this ONLY affects new subscriptions, not existing orgs' billing
  // actions.
  @Get('/settings/payment-gateway')
  async getPaymentGatewaySettings(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._paymentGatewaySettingsService.getPublicSettings();
  }

  @Put('/settings/payment-gateway')
  async updatePaymentGatewaySettings(
    @GetUserFromRequest() user: User,
    @Body() body: PaymentGatewaySettingsDto
  ) {
    this.assertSuperAdmin(user);
    return this._paymentGatewaySettingsService.updateSettings(body);
  }

  @Get('/errors')
  async listErrors(
    @GetUserFromRequest() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('platform') platform?: string,
    @Query('email') email?: string,
    @Query('unknownFirst') unknownFirst?: string
  ) {
    this.assertSuperAdmin(user);
    return this._errorsService.listErrors({
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
      platform: platform || undefined,
      email: email || undefined,
      unknownFirst: unknownFirst === 'true' || unknownFirst === '1',
    });
  }

  @Get('/errors/platforms')
  async listPlatforms(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._errorsService.listPlatforms();
  }

  @Get('/stats')
  async getStats(
    @GetUserFromRequest() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('unknownOnly') unknownOnly?: string
  ) {
    this.assertSuperAdmin(user);

    const fromDate = from ? dayjs(from) : dayjs().subtract(30, 'day');
    const toDate = to ? dayjs(to) : dayjs();

    return this._adminStatsService.getStats({
      from: fromDate.startOf('day').toDate(),
      to: toDate.endOf('day').toDate(),
      unknownOnly: unknownOnly === 'true' || unknownOnly === '1',
    });
  }
}
