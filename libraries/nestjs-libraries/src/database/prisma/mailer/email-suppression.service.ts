import { Injectable } from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { EmailSuppressionRepository } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-suppression.repository';

// One-click unsubscribe: the link embedded in every campaign footer
// carries a signed token (reusing AuthService.signJWT, the same signer
// billing.controller.ts uses for its discount token) rather than the
// plain email address, so the link can't be used to unsubscribe someone
// else's address and doesn't need a login to work from an email client.
@Injectable()
export class EmailSuppressionService {
  constructor(private _emailSuppressionRepository: EmailSuppressionRepository) {}

  list() {
    return this._emailSuppressionRepository.list();
  }

  buildUnsubscribeToken(email: string): string {
    return AuthService.signJWT({ unsubscribe: email.toLowerCase() });
  }

  // Public GET route, no auth - lives on the backend (PublicController's
  // /public/mailer/unsubscribe), not the frontend, matching every other
  // backend-authored outbound link in this codebase (see start.mcp.ts) -
  // there is no frontend proxy route to send this through instead.
  buildUnsubscribeUrl(email: string): string {
    const base = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
    const token = this.buildUnsubscribeToken(email);
    return `${base}/public/mailer/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  async unsubscribeByToken(token: string): Promise<string | null> {
    let payload: { unsubscribe?: string };
    try {
      payload = AuthService.verifyJWT(token) as { unsubscribe?: string };
    } catch {
      return null;
    }
    if (!payload?.unsubscribe) return null;
    await this._emailSuppressionRepository.add(
      payload.unsubscribe,
      'unsubscribed'
    );
    return payload.unsubscribe;
  }

  suppress(email: string, reason: string) {
    return this._emailSuppressionRepository.add(email, reason);
  }

  unsuppress(email: string) {
    return this._emailSuppressionRepository.remove(email);
  }
}
