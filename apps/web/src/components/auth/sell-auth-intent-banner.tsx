"use client";

import { SELL_AUTH_INTENT_BANNER } from "@/lib/marketing/sell-flow-copy";
import { useSearchParams } from "next/navigation";

export function SellAuthIntentBanner() {
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");

  if (intent !== "sell") return null;

  return (
    <output className="mb-4 block rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-center font-body text-sm text-on-surface">
      {SELL_AUTH_INTENT_BANNER}
    </output>
  );
}
