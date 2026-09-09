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
import dayjs from 'dayjs';

@ApiTags('Admin')
@Controller('/admin')
export class AdminController {
  constructor(
    private _errorsService: ErrorsService,
    private _adminStatsService: AdminStatsService,
    private _usersService: UsersService,
    private _paymentGatewaySettingsService: PaymentGatewaySettingsService
  ) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
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
