import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const SETTINGS_ROW_ID = 'default';

export interface PaymentGatewayCredentialsPatch {
  stripeSecretKey?: string | null;
  razorpayKeyId?: string | null;
  razorpayKeySecret?: string | null;
  inrToUsdRate?: number | null;
}

@Injectable()
export class PaymentGatewaySettingsRepository {
  constructor(
    private _settings: PrismaRepository<'paymentGatewaySettings'>
  ) {}

  getSettings() {
    return this._settings.model.paymentGatewaySettings.findUnique({
      where: { id: SETTINGS_ROW_ID },
    });
  }

  setActiveGateway(activeGateway: 'stripe' | 'razorpay' | null) {
    return this._settings.model.paymentGatewaySettings.upsert({
      where: { id: SETTINGS_ROW_ID },
      create: { id: SETTINGS_ROW_ID, activeGateway },
      update: { activeGateway },
    });
  }

  // Generic patch used for the credential fields - `update`/`create` share
  // the same partial payload since a fresh install has no row yet and the
  // very first save (e.g. only a Stripe key) must still create it.
  patch(data: PaymentGatewayCredentialsPatch) {
    return this._settings.model.paymentGatewaySettings.upsert({
      where: { id: SETTINGS_ROW_ID },
      create: { id: SETTINGS_ROW_ID, ...data },
      update: data,
    });
  }
}
