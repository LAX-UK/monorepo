import { type EnquiryRateLimiter, createEnquiryRateLimiter } from "../enquiry-rate-limit.js";
import type { FixedWindowCounter } from "../ports/fixed-window-counter.js";

/**
 * Per-account allowances for applying. Every route needs a signed-in account, so the account is
 * the bucket (a shared office address never blocks a neighbour). Generous enough for an artist
 * who uploads, replaces and edits at length; tight enough that one account cannot fill storage.
 */
export const ARTIST_APPLICATION_RATE_LIMITS = {
  /** Image uploads: twelve works, replaced a few times over. */
  upload: { max: 40, windowSeconds: 3600 },
  /** Draft saves: each step saves, and an artist may go back and forth for an hour. */
  save: { max: 240, windowSeconds: 3600 },
  /** Starting and sending: a handful a day is already unusual. */
  submit: { max: 10, windowSeconds: 86_400 },
} as const;

export type ArtistApplicationRateKind = keyof typeof ARTIST_APPLICATION_RATE_LIMITS;

export type ArtistApplicationRateLimiters = Record<ArtistApplicationRateKind, EnquiryRateLimiter>;

/** One limiter per kind, each with its own keys, on the shared counter. */
export function createArtistApplicationRateLimiters(
  counter: FixedWindowCounter,
): ArtistApplicationRateLimiters {
  const limiter = (kind: ArtistApplicationRateKind) =>
    createEnquiryRateLimiter(counter, {
      keyPrefix: `artist-application-${kind}`,
      limits: {
        perSender: ARTIST_APPLICATION_RATE_LIMITS[kind],
        // Signed-in only: the per-IP allowance is never consulted (no IP is passed).
        perClientIp: ARTIST_APPLICATION_RATE_LIMITS[kind],
      },
    });
  return { upload: limiter("upload"), save: limiter("save"), submit: limiter("submit") };
}
