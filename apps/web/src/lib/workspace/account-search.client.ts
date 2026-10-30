"use client";

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { type AccountSearchResult, accountSearchResultSchema } from "./account-search";

/** Searches the acting account; the port the palette depends on, so tests pass a fake. */
export type AccountSearchPort = (
  query: string,
  signal: AbortSignal,
) => Promise<AccountSearchResult | null>;

/**
 * The account's record search through Bid's BFF. The acting account travels as the
 * legal-entity header (`browserFetch`), so the API answers for that account and that role only.
 * `null` when the search is unavailable, which the palette shows as such.
 */
export const searchAccountRecords: AccountSearchPort = async (query, signal) => {
  const url = `${browserApiBase()}/legal-entities/search?q=${encodeURIComponent(query.trim())}`;
  const res = await browserFetch(url, { signal, cache: "no-store" });
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = accountSearchResultSchema.safeParse((body as { data: unknown }).data);
  return parsed.success ? parsed.data : null;
};
