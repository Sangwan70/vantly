import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { EmailGroup } from '@prisma/client';

export interface ResolvedRecipient {
  email: string;
  userId?: string;
}

// Resolves an EmailGroup into the actual, deduplicated, non-suppressed
// recipient list at the moment it's called - groups are live queries
// (except MANUAL), never a stored snapshot, so a campaign always reaches
// whoever currently matches. Every caller (member-count preview, CSV
// export, and the real send) goes through this same function so they
// never disagree about who counts as a recipient.
@Injectable()
export class MailerRecipientsService {
  constructor(
    private _user: PrismaRepository<'user'>,
    private _emailSuppression: PrismaRepository<'emailSuppression'>
  ) {}

  private async usersWithSubscriptionFlag() {
    const users = await this._user.model.user.findMany({
      where: { activated: true },
      select: {
        id: true,
        email: true,
        organizations: {
          where: { disabled: false },
          select: {
            organization: {
              select: { subscription: { select: { deletedAt: true } } },
            },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      hasSubscription: u.organizations.some(
        (o) =>
          !!o.organization.subscription && !o.organization.subscription.deletedAt
      ),
    }));
  }

  async resolveGroup(
    group: Pick<EmailGroup, 'type' | 'memberEmails' | 'smartRules'>
  ): Promise<ResolvedRecipient[]> {
    let candidates: { id?: string; email: string }[];

    if (group.type === 'MANUAL') {
      candidates = (group.memberEmails || []).map((email) => ({ email }));
    } else {
      const withFlag = await this.usersWithSubscriptionFlag();
      if (group.type === 'ALL_USERS') {
        candidates = withFlag;
      } else {
        // SMART - the only rule implemented today is hasSubscription
        // (true = "Subscribers", false = "Free"); an unrecognized/missing
        // rule falls back to every user rather than silently sending to
        // no one.
        const rules = (group.smartRules || {}) as { hasSubscription?: boolean };
        candidates =
          typeof rules.hasSubscription === 'boolean'
            ? withFlag.filter((u) => u.hasSubscription === rules.hasSubscription)
            : withFlag;
      }
    }

    const byEmail = new Map<string, ResolvedRecipient>();
    for (const candidate of candidates) {
      const email = candidate.email?.trim().toLowerCase();
      if (!email || byEmail.has(email)) continue;
      byEmail.set(email, { email, userId: candidate.id });
    }

    const suppressed = await this._emailSuppression.model.emailSuppression.findMany(
      { select: { email: true } }
    );
    const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));

    return [...byEmail.values()].filter((r) => !suppressedSet.has(r.email));
  }
}
