import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Provider, Role } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { UserDetailDto } from '@gitroom/nestjs-libraries/dtos/users/user.details.dto';
import { EmailNotificationsDto } from '@gitroom/nestjs-libraries/dtos/users/email-notifications.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

@Injectable()
export class UsersRepository {
  constructor(
    private _user: PrismaRepository<'user'>,
    private _transaction: PrismaTransaction
  ) {}

  async switchUserCredentials(currentUserId: string, targetUserId: string) {
    const current = await this._user.model.user.findUnique({
      where: { id: currentUserId },
    });
    const target = await this._user.model.user.findUnique({
      where: { id: targetUserId },
    });

    if (!current || !target) {
      throw new Error('User not found');
    }

    const currentCredentials = {
      email: current.email,
      password: current.password,
      providerName: current.providerName,
      providerId: current.providerId,
      account: current.account,
      connectedAccount: current.connectedAccount,
      activated: current.activated,
    };
    const targetCredentials = {
      email: target.email,
      password: target.password,
      providerName: target.providerName,
      providerId: target.providerId,
      account: target.account,
      connectedAccount: target.connectedAccount,
      activated: target.activated,
    };

    // (email, providerName) is unique and checked per-statement, so park the
    // current user on a throwaway email first, then fill each freed slot
    await this._transaction.model.$transaction([
      this._user.model.user.update({
        where: { id: current.id },
        data: { email: `switch-${makeId(10)}-${current.email}` },
      }),
      this._user.model.user.update({
        where: { id: target.id },
        data: currentCredentials,
      }),
      this._user.model.user.update({
        where: { id: current.id },
        data: targetCredentials,
      }),
    ]);

    return {
      kept: { id: current.id, email: targetCredentials.email },
      switched: { id: target.id, email: currentCredentials.email },
    };
  }

  getImpersonateUser(name: string) {
    return this._user.model.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: name,
            },
          },
          {
            email: {
              contains: name,
            },
          },
          {
            id: {
              contains: name,
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 10,
    });
  }

  getUserById(id: string) {
    return this._user.model.user.findFirst({
      where: {
        id,
      },
    });
  }

  promoteToSuperAdmin(id: string) {
    return this._user.model.user.update({
      where: {
        id,
      },
      data: {
        isSuperAdmin: true,
      },
    });
  }

  getUserByEmail(email: string) {
    return this._user.model.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        providerName: Provider.LOCAL,
      },
      include: {
        picture: {
          select: {
            id: true,
            path: true,
          },
        },
      },
    });
  }

  getUserWithActiveSubscriptionByEmail(email: string, excludeUserId: string) {
    return this._user.model.user.findFirst({
      where: {
        email,
        id: { not: excludeUserId },
        organizations: {
          some: {
            role: Role.SUPERADMIN,
            organization: {
              subscription: { is: { deletedAt: null } },
            },
          },
        },
      },
      select: { id: true, email: true, providerName: true },
    });
  }

  activateUser(id: string) {
    return this._user.model.user.update({
      where: {
        id,
      },
      data: {
        activated: true,
      },
    });
  }

  // Repurposes the `activated` flag as a login gate for admin-initiated
  // bans: a banned user fails the same `!user.activated` check that
  // pending-email-verification LOCAL accounts already fail on login.
  deactivateUser(id: string) {
    return this._user.model.user.update({
      where: {
        id,
      },
      data: {
        activated: false,
      },
    });
  }

  // ---- Admin Panel -> Users grid -------------------------------------
  // Shared by the list and detail endpoints so a row and its detail view
  // can never disagree about what "current plan" means: a Subscription row
  // with deletedAt set counts as FREE (mapped in adminMapUser below).
  private readonly adminUserSelect = {
    id: true,
    name: true,
    lastName: true,
    email: true,
    providerName: true,
    activated: true,
    isSuperAdmin: true,
    createdAt: true,
    lastOnline: true,
    organizations: {
      select: {
        id: true,
        role: true,
        disabled: true,
        organization: {
          select: {
            id: true,
            name: true,
            subscription: {
              select: {
                subscriptionTier: true,
                period: true,
                isLifetime: true,
                cancelAt: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    },
  } as const;

  private adminMapUser(u: any) {
    return {
      id: u.id,
      name: u.name,
      lastName: u.lastName,
      email: u.email,
      providerName: u.providerName,
      activated: u.activated,
      isSuperAdmin: u.isSuperAdmin,
      createdAt: u.createdAt,
      lastOnline: u.lastOnline,
      ip: u.ip,
      agent: u.agent,
      timezone: u.timezone,
      sendSuccessEmails: u.sendSuccessEmails,
      sendFailureEmails: u.sendFailureEmails,
      sendStreakEmails: u.sendStreakEmails,
      orgs: (u.organizations || []).map((uo: any) => {
        const sub = uo.organization?.subscription;
        const active = sub && !sub.deletedAt ? sub : null;
        return {
          userOrgId: uo.id,
          orgId: uo.organization?.id,
          orgName: uo.organization?.name,
          role: uo.role,
          disabled: uo.disabled,
          tier: active?.subscriptionTier || 'FREE',
          period: active?.period || null,
          isLifetime: !!active?.isLifetime,
          cancelAt: active?.cancelAt || null,
          channels: (uo.organization?.Integration || []).map((i: any) => ({
            id: i.id,
            name: i.name,
            providerIdentifier: i.providerIdentifier,
            disabled: i.disabled,
          })),
        };
      }),
    };
  }

  async adminListUsers(params: {
    search?: string;
    page: number;
    pageSize: number;
    status: 'all' | 'active' | 'banned';
    tier: string;
    sort: string;
    dir: 'asc' | 'desc';
  }) {
    const and: any[] = [];

    if (params.search) {
      const contains = { contains: params.search, mode: 'insensitive' as const };
      and.push({
        OR: [
          { name: contains },
          { lastName: contains },
          { email: contains },
          { id: { contains: params.search } },
        ],
      });
    }

    if (params.status === 'active') {
      and.push({ activated: true });
    } else if (params.status === 'banned') {
      and.push({ activated: false });
    }

    if (params.tier === 'FREE') {
      and.push({
        NOT: {
          organizations: {
            some: {
              organization: { subscription: { is: { deletedAt: null } } },
            },
          },
        },
      });
    } else if (params.tier && params.tier !== 'ALL') {
      and.push({
        organizations: {
          some: {
            organization: {
              subscription: {
                is: { deletedAt: null, subscriptionTier: params.tier as any },
              },
            },
          },
        },
      });
    }

    const where = and.length ? { AND: and } : {};
    const sortable = ['createdAt', 'lastOnline', 'name', 'email'];
    const sortField = sortable.includes(params.sort) ? params.sort : 'lastOnline';

    const [total, rows] = await Promise.all([
      this._user.model.user.count({ where }),
      this._user.model.user.findMany({
        where,
        select: this.adminUserSelect,
        orderBy: { [sortField]: params.dir } as any,
        skip: params.page * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.adminMapUser(r)),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: (params.page + 1) * params.pageSize < total,
    };
  }

  async adminGetUser(id: string) {
    const row = await this._user.model.user.findUnique({
      where: { id },
      select: {
        ...this.adminUserSelect,
        ip: true,
        agent: true,
        timezone: true,
        sendSuccessEmails: true,
        sendFailureEmails: true,
        sendStreakEmails: true,
        organizations: {
          select: {
            id: true,
            role: true,
            disabled: true,
            organization: {
              select: {
                id: true,
                name: true,
                subscription: {
                  select: {
                    subscriptionTier: true,
                    period: true,
                    isLifetime: true,
                    cancelAt: true,
                    deletedAt: true,
                  },
                },
                Integration: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    name: true,
                    providerIdentifier: true,
                    disabled: true,
                  },
                  take: 100,
                },
              },
            },
          },
        },
      },
    });

    return row ? this.adminMapUser(row) : null;
  }

  adminFindIdentity(id: string) {
    return this._user.model.user.findUnique({
      where: { id },
      select: { id: true, email: true, providerName: true },
    });
  }

  adminEmailTaken(email: string, providerName: Provider, exceptId: string) {
    return this._user.model.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        providerName,
        NOT: { id: exceptId },
      },
      select: { id: true },
    });
  }

  adminUpdateUser(
    id: string,
    data: {
      name?: string | null;
      lastName?: string | null;
      email?: string;
      sendSuccessEmails?: boolean;
      sendFailureEmails?: boolean;
      sendStreakEmails?: boolean;
    }
  ) {
    return this._user.model.user.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  adminUserBelongsToOrg(userId: string, organizationId: string) {
    return this._user.model.user.findFirst({
      where: {
        id: userId,
        organizations: { some: { organizationId } },
      },
      select: { id: true },
    });
  }

  getUserByProvider(providerId: string, provider: Provider) {
    return this._user.model.user.findFirst({
      where: {
        providerId,
        providerName: provider,
      },
    });
  }

  updatePassword(id: string, password: string) {
    return this._user.model.user.update({
      where: {
        id,
        providerName: Provider.LOCAL,
      },
      data: {
        password: AuthService.hashPassword(password),
      },
    });
  }

  changeAudienceSize(userId: string, audience: number) {
    return this._user.model.user.update({
      where: {
        id: userId,
      },
      data: {
        audience,
      },
    });
  }

  async getPersonal(userId: string) {
    const user = await this._user.model.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        bio: true,
        email: true,
        providerName: true,
        picture: {
          select: {
            id: true,
            path: true,
          },
        },
      },
    });

    return user;
  }

  async changePersonal(userId: string, body: UserDetailDto) {
    await this._user.model.user.update({
      where: {
        id: userId,
      },
      data: {
        name: body.fullname,
        lastName: body.lastName,
        bio: body.bio,
        picture: body.picture
          ? {
              connect: {
                id: body.picture.id,
              },
            }
          : {
              disconnect: true,
            },
      },
    });
  }

  async getEmailNotifications(userId: string) {
    return this._user.model.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        sendSuccessEmails: true,
        sendFailureEmails: true,
        sendStreakEmails: true,
      },
    });
  }

  async updateEmailNotifications(userId: string, body: EmailNotificationsDto) {
    await this._user.model.user.update({
      where: {
        id: userId,
      },
      data: {
        sendSuccessEmails: body.sendSuccessEmails,
        sendFailureEmails: body.sendFailureEmails,
        sendStreakEmails: body.sendStreakEmails,
      },
    });
  }
}
