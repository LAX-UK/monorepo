import type { FixedWindowCounter } from "./ports/fixed-window-counter.js";

type RateLimits = {
  perClientIp: { max: number; windowSeconds: number };
  perSender: { max: number; windowSeconds: number };
};

/**
 * Enquiries are open to guests, so each client IP and each sender (typed email, else account)
 * gets a small hourly allowance. A gallery visitor rarely sends more than a couple an hour;
 * the IP allowance is wider because offices and galleries share addresses.
 */
export const ENQUIRY_RATE_LIMITS = {
  perClientIp: { max: 10, windowSeconds: 3600 },
  perSender: { max: 5, windowSeconds: 3600 },
} as const satisfies RateLimits;

/**
 * Edition alerts are open to guests too. A shopper may ask about several sold-out editions in
 * one visit, so the allowance is wider than for enquiries, but an address still cannot be
 * signed up again and again.
 */
export const EDITION_ALERT_RATE_LIMITS = {
  perClientIp: { max: 30, windowSeconds: 3600 },
  perSender: { max: 10, windowSeconds: 3600 },
} as const satisfies RateLimits;

export type EnquiryRateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type EnquiryRateLimiter = {
  consume(input: { clientIp: string | null; senderKey: string }): Promise<EnquiryRateDecision>;
};

export function createEnquiryRateLimiter(
  counter: FixedWindowCounter,
  options: { keyPrefix: string; limits: RateLimits } = {
    keyPrefix: "enquiry",
    limits: ENQUIRY_RATE_LIMITS,
  },
): EnquiryRateLimiter {
  const { keyPrefix, limits } = options;
  return {
    async consume({ clientIp, senderKey }) {
      const checks = [
        { key: `${keyPrefix}:sender:${senderKey}`, ...limits.perSender },
        ...(clientIp ? [{ key: `${keyPrefix}:ip:${clientIp}`, ...limits.perClientIp }] : []),
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

export function createEditionAlertRateLimiter(counter: FixedWindowCounter): EnquiryRateLimiter {
  return createEnquiryRateLimiter(counter, {
    keyPrefix: "edition-alert",
    limits: EDITION_ALERT_RATE_LIMITS,
  });
}
