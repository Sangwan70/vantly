import { Injectable } from '@nestjs/common';
import { EmailGroupRepository } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-group.repository';
import { MailerRecipientsService } from '@gitroom/nestjs-libraries/database/prisma/mailer/mailer-recipients.service';
import { EmailGroupDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-group.dto';

// Seeded once, the first time the group list is loaded on a fresh
// install, so the admin never lands on an empty Groups tab - directly
// restores the original "Subscribers / Free / All, for mailer campaigns"
// admin request, now expressed as three ordinary EmailGroup rows instead
// of a hardcoded tab. An admin can rename/delete/edit these like any other
// group; they are not special-cased anywhere past this seed.
const DEFAULT_GROUPS: Array<
  Pick<EmailGroupDto, 'name' | 'description' | 'type' | 'smartRules'>
> = [
  {
    name: 'All Users',
    description: 'Every registered user.',
    type: 'ALL_USERS',
  },
  {
    name: 'Subscribers',
    description: 'Users on an active paid subscription.',
    type: 'SMART',
    smartRules: { hasSubscription: true },
  },
  {
    name: 'Free',
    description: 'Users with no active subscription.',
    type: 'SMART',
    smartRules: { hasSubscription: false },
  },
];

@Injectable()
export class EmailGroupService {
  constructor(
    private _emailGroupRepository: EmailGroupRepository,
    private _mailerRecipientsService: MailerRecipientsService
  ) {}

  async list() {
    if ((await this._emailGroupRepository.count()) === 0) {
      for (const group of DEFAULT_GROUPS) {
        await this._emailGroupRepository.create({
          ...group,
          memberEmails: [],
        });
      }
    }
    return this._emailGroupRepository.list();
  }

  getById(id: string) {
    return this._emailGroupRepository.getById(id);
  }

  create(body: EmailGroupDto) {
    return this._emailGroupRepository.create(body);
  }

  update(id: string, body: Partial<EmailGroupDto>) {
    return this._emailGroupRepository.update(id, body);
  }

  delete(id: string) {
    return this._emailGroupRepository.delete(id);
  }

  async resolveMembers(id: string) {
    const group = await this._emailGroupRepository.getById(id);
    if (!group) return [];
    return this._mailerRecipientsService.resolveGroup(group);
  }

  // CSV/text import - only meaningful for a MANUAL group (ALL_USERS/SMART
  // resolve live and have no stored member list to import into). Accepts
  // one email per line, or comma-separated on one line, matching a plain
  // .csv export/import round-trip without needing a full CSV-quoting
  // parser for what is just a list of email addresses.
  async importMembers(id: string, rawText: string) {
    const group = await this._emailGroupRepository.getById(id);
    if (!group) throw new Error('Group not found');

    const incoming = rawText
      .split(/[\r\n,]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => /.+@.+\..+/.test(v));

    const merged = new Set([...(group.memberEmails || []), ...incoming]);
    return this._emailGroupRepository.update(id, {
      memberEmails: [...merged],
    });
  }

  async exportMembersCsv(id: string): Promise<string> {
    const members = await this.resolveMembers(id);
    const rows = ['email'];
    for (const member of members) {
      rows.push(member.email);
    }
    return rows.join('\n');
  }
}
