/** Whether a failed bid should keep the user on the confirmation step (step 2). */
export function shouldStayOnBidConfirmStep(
  code: string | null | undefined,
  message: string,
): boolean {
  if (code === "bid_rate_limited_minute" || code === "bid_rate_limited_hour") return true;
  if (code === "bid_limit_exceeded" || code === "bid_in_flight") return true;
  if (/^Bid must be at least\b/.test(message)) return true;
  if (/Dutch|price moved/i.test(message)) return true;
  return false;
}
