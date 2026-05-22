"use client";

import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { LiveDot, cn } from "@auction/ui";
import { Clock } from "lucide-react";
import type { LotTimerState } from "./classify";

function assertNever(x: never): never {
  throw new Error(`Unexpected lot timer state: ${String(x)}`);
}

const PILL_BASE =
  "pointer-events-none absolute bottom-3 left-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[0.1em] backdrop-blur-sm";

const SHELL_LIVE =
  "border-transparent bg-brand-900/85 text-white dark:border-transparent dark:bg-black/80 dark:text-white";

const SHELL_MUTED =
  "border-transparent bg-brand-900/70 text-white/70 dark:border-transparent dark:bg-black/70 dark:text-white/70";

/** Ending-soon tag: glass chip; live shows red dot + countdown only (no “Live” copy). */
const ENDING_SOON_TAG_GLASS =
  "pointer-events-none absolute bottom-4 left-4 z-10 inline-flex h-8 max-w-[calc(100%-2rem)] items-center gap-2 rounded-[5.33px] border-transparent bg-[rgba(18,18,18,0.4)] px-[10.67px] backdrop-blur-[8px]";

const ENDING_SOON_COUNTDOWN =
  "min-w-0 tabular-nums text-base font-semibold leading-4 tracking-normal text-[#D1D1D1]";

const ENDING_SOON_MUTED_SHELL =
  "pointer-events-none absolute bottom-4 left-4 z-10 inline-flex h-8 max-w-[calc(100%-2rem)] items-center rounded-[5.33px] border-transparent bg-[rgba(18,18,18,0.4)] px-[10.67px] backdrop-blur-[8px] font-[family-name:var(--font-poppins)] text-xs font-semibold uppercase leading-4 tracking-wide text-[#D1D1D1]/85";

function ariaLabelFor(state: LotTimerState, clockText?: string): string {
  switch (state.kind) {
    case "live":
      return clockText ? `Live auction. Ends in ${clockText}.` : "Live auction.";
    case "opensSoon":
      return clockText ? `Opens in ${clockText}.` : "Opening soon.";
    case "closed":
      return "Auction closed.";
    case "cancelled":
      return "Auction cancelled.";
    case "unknown":
      return "Auction timing unavailable. Coming soon.";
    default:
      return assertNever(state);
  }
}

export type LotTimerPillVariant = "default" | "endingSoon";

export function LotTimerPill({
  state,
  clockText,
  surfaceClassName,
  variant = "default",
  useOverlayChrome = false,
}: {
  state: LotTimerState;
  clockText?: string;
  /** Merged last so marketing surfaces can override shell (e.g. glass pill). */
  surfaceClassName?: string;
  variant?: LotTimerPillVariant;
  /** Read `--overlay-*` vars from AdaptiveMediaFrame instead of theme glass. */
  useOverlayChrome?: boolean;
}) {
  const overlayTone = useOverlayTone("bottomLeft");
  const overlayShell = useOverlayChrome ? overlayPillClasses(overlayTone) : null;
  const overlayProps = useOverlayChrome ? overlayToneProps(overlayTone) : {};
  const aria = ariaLabelFor(state, clockText);
  const figma = variant === "endingSoon";

  const shellClass = (figmaShell: string, themeShell: string) =>
    useOverlayChrome && !figma
      ? cn(PILL_BASE, overlayShell, surfaceClassName)
      : figma
        ? cn(figmaShell, surfaceClassName)
        : cn(PILL_BASE, themeShell, surfaceClassName);

  const toneProps = useOverlayChrome && !figma ? overlayProps : {};

  switch (state.kind) {
    case "live":
      return (
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(ENDING_SOON_TAG_GLASS, SHELL_LIVE)}
          {...toneProps}
        >
          <LiveDot size="sm" className={figma ? "live-dot-pulse" : ""} />
          {figma ? (
            <span className={ENDING_SOON_COUNTDOWN} aria-hidden>
              {clockText ?? "—"}
            </span>
          ) : (
            <span className="min-w-0">
              <span>Live · </span>
              <span className="tabular-nums" aria-hidden>
                {clockText ?? "—"}
              </span>
            </span>
          )}
        </output>
      );
    case "opensSoon":
      return (
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(ENDING_SOON_TAG_GLASS, SHELL_LIVE)}
          {...toneProps}
        >
          <Clock
            className={cn(
              "shrink-0",
              figma ? "size-4 text-[#D1D1D1]" : "size-3.5 text-accent-brand",
            )}
            aria-hidden
          />
          {figma ? (
            <span className={ENDING_SOON_COUNTDOWN} aria-hidden>
              {clockText ?? "—"}
            </span>
          ) : (
            <span className="min-w-0">
              <span>Opens in </span>
              <span className="tabular-nums" aria-hidden>
                {clockText ?? "—"}
              </span>
            </span>
          )}
        </output>
      );
    case "closed":
      return (
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(ENDING_SOON_MUTED_SHELL, SHELL_MUTED)}
          {...toneProps}
        >
          Closed
        </output>
      );
    case "cancelled":
      return (
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(ENDING_SOON_MUTED_SHELL, SHELL_MUTED)}
          {...toneProps}
        >
          Cancelled
        </output>
      );
    case "unknown":
      return (
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(ENDING_SOON_MUTED_SHELL, SHELL_MUTED)}
          {...toneProps}
        >
          Soon
        </output>
      );
    default:
      return assertNever(state);
  }
}
