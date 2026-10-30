/**
 * The two audiences of the LAX system. They share every token and differ only in type step,
 * control height, row height and a few element sizes: staff scan tables all day, clients read
 * sentences, often on phones, and make fewer, costlier taps.
 */
export type LaxDensity = "staff" | "client";

/** The attribute a shell or a stand-alone region spreads on its root element. */
export function laxDensityAttributes(density: LaxDensity): { "data-lax-density": LaxDensity } {
  return { "data-lax-density": density };
}
