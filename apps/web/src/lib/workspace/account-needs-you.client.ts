"use client";

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { isIndexableObject } from "@/lib/data/http/object-guards";

/** Tasks waiting on the person, by organisation id; organisations with none read 0. */
export type AccountNeedsYouCounts = Readonly<Record<string, number>>;

/** Reads every account's count; the port the switcher depends on, so tests pass a fake. */
export type AccountNeedsYouPort = (signal: AbortSignal) => Promise<AccountNeedsYouCounts | null>;

/**
 * The counts in a `/legal-entities/needs-you/by-account` body, or `null` when the body is not
 * `{ data: { accounts: [{ legalEntityId: string, count: integer >= 0 }] } }`. Written by hand, not
 * with a schema library: this reader is in the header of every page, and the check is this small.
 */
export function parseAccountNeedsYouBody(body: unknown): AccountNeedsYouCounts | null {
  if (!isIndexableObject(body) || !isIndexableObject(body.data)) return null;
  const { accounts } = body.data;
  if (!Array.isArray(accounts)) return null;
  const entries: [string, number][] = [];
  for (const account of accounts) {
    if (!isIndexableObject(account)) return null;
    const { legalEntityId, count } = account;
    if (typeof legalEntityId !== "string") return null;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
    entries.push([legalEntityId, count]);
  }
  return Object.fromEntries(entries);
}

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
  return parseAccountNeedsYouBody(await res.json().catch(() => null));
};
