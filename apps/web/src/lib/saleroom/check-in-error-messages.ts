export const SALEROOM_CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  sale_not_saleroom: "Check-in is only available for onsite or hybrid sales.",
  sale_not_registerable: "This sale is not open for check-in.",
  user_suspended: "This client account is suspended.",
  kyc_required: "Client must complete identity verification before check-in.",
  email_not_verified: "Client must verify their email address.",
  membership_required: "Client is not a member of the selected entity.",
  entity_not_authorised: "The selected entity is not authorised to bid.",
  not_eligible_for_check_in: "This membership type cannot be checked in for in-room bidding.",
  paddle_taken: "That paddle number is already in use. Try another or leave blank to auto-assign.",
  invalid_paddle: "Paddle number must be at least 100.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
};

export function saleroomCheckInErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return SALEROOM_CHECK_IN_ERROR_MESSAGES[code] ?? fallback;
}
