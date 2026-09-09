import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class PaymentGatewaySettingsDto {
  // null clears the admin override and falls back to the PAYMENT_GATEWAY
  // env var (defaulting to razorpay) - see resolveActiveGateway().
  @IsOptional()
  @IsIn(['stripe', 'razorpay'])
  activeGateway?: 'stripe' | 'razorpay' | null;

  // Secrets never round-trip back to the browser (GET only ever returns a
  // `set`/`source` indicator, never the value itself - see
  // PaymentGatewaySettingsService.getPublicSettings). PUT only touches a
  // secret when a non-empty value is submitted here, or when its matching
  // `clear*` flag is set - an admin re-saving the form with the masked
  // placeholder must never overwrite the real stored secret with blank.

  @IsOptional()
  @IsString()
  stripeSecretKey?: string;

  @IsOptional()
  @IsBoolean()
  clearStripeSecretKey?: boolean;

  // RazorPay's key id + secret are stored and cleared together - a lone key
  // id or lone secret is useless (resolveRazorpayCredentials requires both
  // from the same source), so there is no separate clear flag per field.
  @IsOptional()
  @IsString()
  razorpayKeyId?: string;

  @IsOptional()
  @IsString()
  razorpayKeySecret?: string;

  @IsOptional()
  @IsBoolean()
  clearRazorpayCredentials?: boolean;

  // Display-only USD->INR estimate used when RazorPay is active (see
  // schema.prisma's PaymentGatewaySettings.inrToUsdRate doc comment). null
  // resets to the built-in fallback rate, same null-clears convention as
  // activeGateway above.
  @IsOptional()
  @ValidateIf((o) => o.inrToUsdRate !== null)
  @IsNumber()
  @Min(0.01)
  inrToUsdRate?: number | null;
}
