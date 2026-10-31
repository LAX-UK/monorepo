"use client";

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { z } from "zod";

/** Tasks waiting on the person, by organisation id; organisations with none read 0. */
export type AccountNeedsYouCounts = Readonly<Record<string, number>>;

/** Reads every account's count; the port the switcher depends on, so tests pass a fake. */
export type AccountNeedsYouPort = (signal: AbortSignal) => Promise<AccountNeedsYouCounts | null>;

const responseSchema = z.object({
  data: z.object({
    accounts: z.array(
      z.object({ legalEntityId: z.string(), count: z.number().int().nonnegative() }),
    ),
  }),
});

/**
 * Needs you for each of the person's organisations, from the same reader as each account's Home
 * (`GET /legal-entities/needs-you/by-account`). `null` when it is unavailable: the switcher then
 * shows no dots rather than wrong ones.
 */
export const readAccountNeedsYou: AccountNeedsYouPort = async (signal) => {
  const res = await browserFetch(`${browserApiBase()}/legal-entities/needs-you/by-account`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const parsed = responseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return null;
  return Object.fromEntries(parsed.data.data.accounts.map((a) => [a.legalEntityId, a.count]));
};
