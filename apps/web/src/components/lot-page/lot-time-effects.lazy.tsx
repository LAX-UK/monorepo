"use client";

import dynamic from "next/dynamic";

/**
 * The lot page's time effects (announcements and the result safety net) draw nothing, so they
 * load after the page is interactive rather than with its first scripts.
 */
export const LotTimeEffectsLazy = dynamic(
  () => import("./lot-time-effects").then((m) => m.LotTimeEffects),
  { ssr: false },
);
