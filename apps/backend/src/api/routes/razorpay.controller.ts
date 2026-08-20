import {
  Controller,
  HttpException,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { RazorpayService } from '@gitroom/nestjs-libraries/services/razorpay.service';
import { ApiTags } from '@nestjs/swagger';

/**
 * RazorPay webhook receiver - the INR-billing counterpart to
 * stripe.controller.ts. Configure this URL (/razorpay) as a webhook
 * endpoint in the RazorPay Dashboard (Settings -> Webhooks) subscribed to
 * at least: subscription.activated, subscription.charged,
 * subscription.cancelled, subscription.completed, subscription.halted.
 *
 * Only reachable/meaningful when PAYMENT_GATEWAY=razorpay, but registering
 * the controller unconditionally is harmless - RazorpayService.isAvailable()
 * / verifyWebhookSignature() already fail closed when RazorPay env vars
 * aren't configured.
 */
@ApiTags('Razorpay')
@Controller('/razorpay')
export class RazorpayController {
  constructor(private readonly _razorpayService: RazorpayService) {}

  @Post('/')
  async razorpay(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const signature = req.headers['x-razorpay-signature'] as string | undefined;

    if (!rawBody || !this._razorpayService.verifyWebhookSignature(rawBody, signature)) {
      throw new HttpException('Invalid RazorPay webhook signature', 400);
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = payload?.event as string | undefined;

    if (!event) {
      return { ok: true };
    }

    try {
      switch (event) {
        case 'subscription.activated':
        case 'subscription.charged':
          await this._razorpayService.handleSubscriptionActivatedOrCharged(payload);
          return { ok: true };
        case 'subscription.cancelled':
        case 'subscription.completed':
        case 'subscription.halted':
          await this._razorpayService.handleSubscriptionEnded(payload, event);
          return { ok: true };
        default:
          return { ok: true };
      }
    } catch (e) {
      throw new HttpException(e, 500);
    }
  }
}
