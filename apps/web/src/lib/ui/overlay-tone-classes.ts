import { DEFAULT_OVERLAY_TONE } from "@/hooks/use-image-overlay-tones";
import type { OverlayToneResult } from "@/lib/media/overlay-tone-types";
import { cn } from "@auction/ui";

/** Where overlay chrome is rendered — decouples visual shell from layout positioning. */
export type OverlaySurface = "auto" | "onImage" | "inline";

export function resolveOverlayChrome(
  surface: OverlaySurface,
  layout: "overlay" | "inline",
  inFrame: boolean,
): boolean {
  if (surface === "onImage") return true;
  if (surface === "inline") return false;
  return layout === "overlay" || inFrame;
}

const toneAttrs = (result: OverlayToneResult) => ({
  "data-overlay-tone": result.tone,
  ...(result.kind === "opaque" ? { "data-overlay-fallback": "opaque" as const } : {}),
});

/** Saleroom hero action row: 40px height, shared by Follow / Verify / primary CTAs. */
export const saleroomHeroActionSizing =
  "box-border h-10 min-h-10 px-8 font-body text-base font-semibold leading-6 tracking-[0.8px]";

/** Frosted or opaque pill / chip chrome over imagery. */
export function overlayPillClasses(result: OverlayToneResult, extra?: string): string {
  return cn(
    "border text-[color:var(--overlay-fg)] bg-[color:var(--overlay-bg)] border-[color:var(--overlay-border)]",
    result.kind === "frosted" && "backdrop-blur-sm",
    extra,
  );
}

/** Circular icon button shell (watchlist heart). */
export function overlayIconButtonClasses(result: OverlayToneResult, extra?: string): string {
  return cn(
    overlayPillClasses(result),
    "inline-flex items-center justify-center rounded-full transition-colors motion-reduce:transition-none",
    "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
    extra,
  );
}

/** Outlined secondary CTA on hero imagery (e.g. Follow). */
export function overlayOutlineButtonClasses(result: OverlayToneResult, extra?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[4px] border bg-transparent transition-opacity motion-reduce:transition-none",
    "border-[color:var(--overlay-border)] text-[color:var(--overlay-fg)]",
    "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
    result.kind === "frosted" && "backdrop-blur-sm bg-[color:var(--overlay-bg)]",
    extra,
  );
}

/** Body / meta copy over imagery. */
export function overlayTextClasses(_result: OverlayToneResult, extra?: string): string {
  return cn("text-[color:var(--overlay-fg)]", extra);
}

/** Muted secondary line within a content block. */
export function overlayTextMutedClasses(_result: OverlayToneResult, extra?: string): string {
  return cn("text-[color:var(--overlay-fg)] opacity-70", extra);
}

/** Display heading within a content block. */
export function overlayDisplayClasses(result: OverlayToneResult, extra?: string): string {
  return overlayTextClasses(result, cn("font-semibold", extra));
}

export function overlayToneProps(result: OverlayToneResult) {
  return toneAttrs(result);
}

/** Default light frosted shell when on-image but outside AdaptiveMediaFrame. */
export function defaultOverlayIconButton(extra?: string): string {
  return overlayIconButtonClasses(DEFAULT_OVERLAY_TONE, extra);
}

export function defaultOverlayToneProps() {
  return overlayToneProps(DEFAULT_OVERLAY_TONE);
}
