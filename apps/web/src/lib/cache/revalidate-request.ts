import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { CATALOGUE_LOTS_TAG, CATALOGUE_SALES_TAG, isPublicItemTag } from "@/lib/data/cache-tags";
import { z } from "zod";

export const REVALIDATE_SECRET_HEADER = "x-revalidate-secret";

/** One event names a lot and its sale plus the two catalogue lists; a batch carries a few events. */
const MAX_TAGS_PER_REQUEST = 50;

const BROAD_TAGS = new Set<string>([CATALOGUE_LOTS_TAG, CATALOGUE_SALES_TAG]);

const RevalidateBodySchema = z.object({
  tags: z
    .array(
      z
        .string()
        .max(120)
        .refine((tag) => BROAD_TAGS.has(tag) || isPublicItemTag(tag)),
    )
    .min(1)
    .max(MAX_TAGS_PER_REQUEST),
});

/** Hashing first gives equal-length buffers, so the comparison leaks neither content nor length. */
export function secretMatches(provided: string | null, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided ?? ""), digest(expected)) && provided !== null;
}

/**
 * The de-duplicated tags, or null when the body is malformed or names a tag this route does not
 * purge. Only the public sale and lot tags and the two catalogue list tags can be dropped from
 * outside, so a leaked secret can at worst make those pages re-read the API.
 */
export function parseRevalidateTags(body: unknown): string[] | null {
  const parsed = RevalidateBodySchema.safeParse(body);
  return parsed.success ? [...new Set(parsed.data.tags)] : null;
}

type Window = { startedAt: number; count: number };

/**
 * Per-instance fixed-window counter keyed by caller address. The callers are the API and the
 * worker, which send at most one request per committed change; the limit blunts secret guessing.
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
