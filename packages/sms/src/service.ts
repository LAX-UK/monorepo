export type SendOtpOptions = {
  /** End-user IP for Twilio Service Rate Limits (hashed before send). */
  ipAddress?: string | undefined;
};

export interface IPhoneVerificationService {
  isConfigured(): boolean;
  sendOtp(phoneE164: string, opts?: SendOtpOptions): Promise<{ sid: string }>;
  checkOtp(phoneE164: string, code: string): Promise<{ valid: boolean }>;
}
