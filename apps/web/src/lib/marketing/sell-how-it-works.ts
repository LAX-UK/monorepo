import { SPECIALIST_RESPONSE_PROMISE } from "@/lib/marketing/sell-flow-copy";

export type SellHowItWorksStep = { title: string; body: string };

/** The three steps of selling, worded once for the home page and the selling page. */
export const SELL_HOW_IT_WORKS_STEPS: readonly SellHowItWorksStep[] = [
  { title: "Tell us about it", body: "Photos and a few details, in about three minutes." },
  { title: "Free valuation", body: SPECIALIST_RESPONSE_PROMISE },
  { title: "Consign", body: "We catalogue, photograph and sell it, and pay you after the sale." },
] as const;
