/** Identity-owned SMS verification port; mirrors @auction/sms without that dependency. */

export type SendOtpOptions = {
  ipAddress?: string | undefined;
};

export type SmsSender = {
  isConfigured(): boolean;
  sendOtp(phoneE164: string, opts?: SendOtpOptions): Promise<{ sid: string }>;
  checkOtp(phoneE164: string, code: string): Promise<{ valid: boolean }>;
};
