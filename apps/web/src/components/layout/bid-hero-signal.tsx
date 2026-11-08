"use client";

import { bidHeroPresence } from "@/lib/layout/bid-hero-presence";
import { useLayoutEffect } from "react";

/** Rendered with a cover photograph that starts under the header, so the header can go transparent. */
export function BidHeroSignal() {
  useLayoutEffect(() => bidHeroPresence.register(), []);
  return null;
}
