import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from '@gitroom/nestjs-libraries/database/prisma/users/users.repository';
import { Provider, User } from '@prisma/client';
import { UserDetailDto } from '@gitroom/nestjs-libraries/dtos/users/user.details.dto';
import { EmailNotificationsDto } from '@gitroom/nestjs-libraries/dtos/users/email-notifications.dto';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private _usersRepository: UsersRepository,
    private _organizationRepository: OrganizationRepository,
    private _notificationService: NotificationService
  ) {}

  private readonly _logger = new Logger(UsersService.name);

  getUserByEmail(email: string) {
    return this._usersRepository.getUserByEmail(email);
  }

  getUserById(id: string) {
    return this._usersRepository.getUserById(id);
  }

  // Self-heals existing accounts: if this user's email matches SUPER_ADMIN_USER
  // but they registered before the flag existed (or before the env var was
  // set), promote them to super admin on next login instead of requiring a
  // manual DB update.
  private static isSuperAdminEmail(email: string) {
    const superAdminEmail = process.env.SUPER_ADMIN_USER;
    return (
      !!superAdminEmail &&
      !!email &&
      email.toLowerCase() === superAdminEmail.trim().toLowerCase()
    );
  }

  async ensureSuperAdmin(user: User): Promise<User> {
    if (!user || user.isSuperAdmin || !UsersService.isSuperAdminEmail(user.email)) {
      return user;
    }

    await this._usersRepository.promoteToSuperAdmin(user.id);
    return { ...user, isSuperAdmin: true };
  }

  getUserWithActiveSubscriptionByEmail(email: string, excludeUserId: string) {
    return this._usersRepository.getUserWithActiveSubscriptionByEmail(
      email,
      excludeUserId
    );
  }

  getImpersonateUser(name: string) {
    return this._organizationRepository.getImpersonateUser(name);
  }

  getUserByProvider(providerId: string, provider: Provider) {
    return this._usersRepository.getUserByProvider(providerId, provider);
  }

  async switchUser(
    currentUserId: string,
    targetUserId: string,
    adminId: string
  ) {
    const { kept, switched } =
      await this._usersRepository.switchUserCredentials(
        currentUserId,
        targetUserId
      );

    this._logger.log(
      `User login switch performed by admin ${adminId}: account ${
        kept.id
      } login ${switched.email} -> ${kept.email}; account ${
        switched.id
      } login ${kept.email} -> ${switched.email}`
    );

    // the swap is already committed; a notification failure must not fail it
    if (this._notificationService.hasEmailProvider()) {
      await Promise.all(
        [kept, switched].map((account) =>
          this._notificationService
            .sendEmail(
              account.email,
              'Your Postiz login was changed',
              `An administrator changed the login for your Postiz account. ` +
                `You can now sign in using ${account.email}. ` +
                `Your subscription and plan were not changed by this switch — ` +
                `if you intended to cancel a subscription, please do that ` +
                `separately from your billing settings.`
            )
            .catch((err) =>
              this._logger.error(`Failed to notify ${account.email}`, err)
            )
        )
      );
    }

    return { kept, switched };
  }

  activateUser(id: string) {
    return this._usersRepository.activateUser(id);
  }

  banUser(id: string) {
    return this._usersRepository.deactivateUser(id);
  }

  unbanUser(id: string) {
    return this._usersRepository.activateUser(id);
  }

  updatePassword(id: string, password: string) {
    return this._usersRepository.updatePassword(id, password);
  }

  // Throws a plain Error (not HttpException) for expected, user-actionable
  // failures (wrong current password, OAuth account with no password) -
  // the controller catches and re-throws these as a proper 400 so the
  // message reaches the settings UI instead of being masked by Nest's
  // default 500 handler.
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const user = await this._usersRepository.getUserById(userId);

    if (!user || user.providerName !== Provider.LOCAL || !user.password) {
      throw new Error(
        'Password change is not available for this account.'
      );
    }

    if (!AuthChecker.comparePassword(oldPassword, user.password)) {
      throw new Error('Current password is incorrect.');
    }

    await this._usersRepository.updatePassword(userId, newPassword);
    return { success: true };
  }

  getPersonal(userId: string) {
    return this._usersRepository.getPersonal(userId);
  }

  changePersonal(userId: string, body: UserDetailDto) {
    return this._usersRepository.changePersonal(userId, body);
  }

  getEmailNotifications(userId: string) {
    return this._usersRepository.getEmailNotifications(userId);
  }

  updateEmailNotifications(userId: string, body: EmailNotificationsDto) {
    return this._usersRepository.updateEmailNotifications(userId, body);
  }
}
