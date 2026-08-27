import type { MarketingPromptTrigger } from "./types";

export function resolveSellingIntentTrigger({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}): Extract<MarketingPromptTrigger, "sell-content" | "sell-query"> | null {
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return "sell-content";

  const params = new URLSearchParams(search);
  const intent = params.get("intent")?.toLowerCase();
  if (intent === "sell" || intent === "selling" || intent === "valuation") return "sell-query";

  const campaign = (params.get("utm_campaign")?.toLowerCase() ?? "").replace(/[_-]+/g, " ");
  return /\b(sell|selling|consign|consignment|valuation)\b/.test(campaign) ? "sell-query" : null;
}
