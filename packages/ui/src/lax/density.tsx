"use client";

import * as React from "react";

/**
 * The two audiences of the LAX system. They share every token and differ only in type step,
 * control height, row height and a few element sizes: staff scan tables all day, clients read
 * sentences, often on phones, and make fewer, costlier taps.
 */
export type LaxDensity = "staff" | "client";

const DensityContext = React.createContext<LaxDensity | undefined>(undefined);

/**
 * Gives everything inside the shell's density. The shell also spreads `laxDensityAttributes` on
 * its root, which the density tokens and the `in-data-[lax-density=…]` variants read; this
 * context reaches the portalled layers, since a menu or dialog rendered at the end of `<body>`
 * sits outside that attribute.
 */
export function LaxDensityProvider({
  density,
  children,
}: {
  density: LaxDensity;
  children: React.ReactNode;
}) {
  return <DensityContext.Provider value={density}>{children}</DensityContext.Provider>;
}

/** The density set by the nearest `LaxDensityProvider`, if any. */
export function useLaxDensity(): LaxDensity | undefined {
  return React.useContext(DensityContext);
}

/** The attribute a shell or a stand-alone region spreads on its root element. */
export function laxDensityAttributes(density: LaxDensity): { "data-lax-density": LaxDensity } {
  return { "data-lax-density": density };
}

/**
 * Props for a portalled layer (menu, tooltip, dialog, toast): it is LAX UI (font, icon stroke)
 * and keeps the density of the place it was opened from.
 */
export function useLayerAttributes(): { "data-lax-ui": ""; "data-lax-density"?: LaxDensity } {
  const density = useLaxDensity();
  return density ? { "data-lax-ui": "", "data-lax-density": density } : { "data-lax-ui": "" };
}
