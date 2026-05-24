/** Veriff requires endUserId to be UUID v4; other ids belong in vendorData only. */
const VERIFF_END_USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VeriffCreateSessionVerification = {
  callback: string;
  vendorData: string;
  endUserId?: string;
};

export function buildVeriffCreateSessionVerification(input: {
  userId: string;
  callbackUrl: string;
}): VeriffCreateSessionVerification {
  const userId = input.userId.trim();
  return {
    callback: input.callbackUrl,
    vendorData: userId,
    ...(VERIFF_END_USER_ID_RE.test(userId) ? { endUserId: userId } : {}),
  };
}
