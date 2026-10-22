import { createHash, timingSafeEqual } from "node:crypto";
import { REVALIDATABLE_ART_TAGS, type RevalidatableArtTag } from "@/lib/art-cache-tags";
import { z } from "zod";

export const REVALIDATE_SECRET_HEADER = "x-revalidate-secret";

const MAX_TAGS_PER_REQUEST = 5;

const RevalidateBodySchema = z.object({
  tags: z.array(z.enum(REVALIDATABLE_ART_TAGS)).min(1).max(MAX_TAGS_PER_REQUEST),
});

/** Hashing first gives equal-length buffers, so the comparison leaks neither content nor length. */
export function secretMatches(provided: string | null, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided ?? ""), digest(expected)) && provided !== null;
}

/** Returns the de-duplicated tags, or null when the body is malformed or names a tag outside the allowlist. */
export function parseRevalidateTags(body: unknown): RevalidatableArtTag[] | null {
  const parsed = RevalidateBodySchema.safeParse(body);
  return parsed.success ? [...new Set(parsed.data.tags)] : null;
}

type Window = { startedAt: number; count: number };

/**
 * Per-instance fixed-window counter keyed by caller address. The only legitimate caller is
 * shop-api, which sends a handful of requests per minute; the limit exists to blunt secret
 * guessing and purge storms, so per-instance accuracy is enough.
 */
export function createRevalidateRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const windows = new Map<string, Window>();
  return {
    allow(key: string): boolean {
      const current = now();
      if (windows.size > 1_000) {
        for (const [k, w] of windows) {
          if (current - w.startedAt >= options.windowMs) windows.delete(k);
        }
      }
      const existing = windows.get(key);
      if (!existing || current - existing.startedAt >= options.windowMs) {
        windows.set(key, { startedAt: current, count: 1 });
        return true;
      }
      existing.count += 1;
      return existing.count <= options.limit;
    },
  };
}
