"use client";

import { registerArtHero } from "@/lib/layout/art-hero-presence";
import { useLayoutEffect } from "react";

/** Rendered with every hero that starts under the header, so the header can turn transparent. */
export function ArtHeroSignal() {
  useLayoutEffect(() => registerArtHero(), []);
  return null;
}
