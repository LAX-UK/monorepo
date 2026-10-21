import type { FixedWindowCounter } from "./ports/fixed-window-counter.js";

/**
 * Enquiries are open to guests, so each client IP and each sender (typed email, else account)
 * gets a small hourly allowance. A gallery visitor rarely sends more than a couple an hour;
 * the IP allowance is wider because offices and galleries share addresses.
 */
export const ENQUIRY_RATE_LIMITS = {
  perClientIp: { max: 10, windowSeconds: 3600 },
  perSender: { max: 5, windowSeconds: 3600 },
} as const;

export type EnquiryRateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type EnquiryRateLimiter = {
  consume(input: { clientIp: string | null; senderKey: string }): Promise<EnquiryRateDecision>;
};

export function createEnquiryRateLimiter(counter: FixedWindowCounter): EnquiryRateLimiter {
  return {
    async consume({ clientIp, senderKey }) {
      const checks = [
        { key: `enquiry:sender:${senderKey}`, ...ENQUIRY_RATE_LIMITS.perSender },
        ...(clientIp
          ? [{ key: `enquiry:ip:${clientIp}`, ...ENQUIRY_RATE_LIMITS.perClientIp }]
          : []),
      ];
      const hits = await Promise.all(
        checks.map(async (check) => ({
          max: check.max,
          ...(await counter.increment(check.key, check.windowSeconds)),
        })),
      );
      const blocked = hits.filter((hit) => hit.count > hit.max);
      if (blocked.length === 0) return { allowed: true };
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, ...blocked.map((hit) => hit.resetInSeconds)),
      };
    },
  };
}
