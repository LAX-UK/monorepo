"use client";

import dynamic from "next/dynamic";

/**
 * The lot page's spoken time marks and its ask for a result draw nothing, so they load after the
 * page is up and are not part of its first JavaScript.
 */
export const LotTimeEffects = dynamic(
  () => import("./lot-time-effects").then((m) => m.LotTimeEffects),
  { ssr: false },
);
