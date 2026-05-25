import type { OverlayToneResult } from "@/lib/media/overlay-tone-types";
import { cn } from "@auction/ui";

const toneAttrs = (result: OverlayToneResult) => ({
  "data-overlay-tone": result.tone,
  ...(result.kind === "opaque" ? { "data-overlay-fallback": "opaque" as const } : {}),
});

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
