"use client";

import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { LiveDot, cn } from "@auction/ui";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import type { LotTimerState } from "./classify";
import type { TimerText } from "./format";

function assertNever(x: never): never {
  throw new Error(`Unexpected lot timer state: ${String(x)}`);
}

/**
 * Overlay pills sit in a full-width, bottom-anchored frame that is also the size container the
 * words-or-clock choice reads (see {@link Value}); the pill itself stays on one line.
 */
const PILL_OVERLAY_FRAME = "pointer-events-none absolute inset-x-3 bottom-3 z-10 flex @container";
const PILL_OVERLAY_POS = "relative inline-flex max-w-full whitespace-nowrap";
const PILL_INLINE_POS =
  "relative inline-flex max-w-full shrink-0 whitespace-nowrap pointer-events-auto";

const PILL_BASE_SHARED =
  "items-center gap-1.5 rounded-full border px-2.5 py-1 font-label text-xs font-medium backdrop-blur-sm";

const SHELL_LIVE =
  "border-transparent bg-brand-900/85 text-white dark:border-transparent dark:bg-black/80 dark:text-white";

const SHELL_MUTED =
  "border-transparent bg-brand-900/70 text-white/70 dark:border-transparent dark:bg-black/70 dark:text-white/70";

/** Ending-soon tag: glass chip; live shows red dot + countdown only (no “Live” copy). */
const ENDING_SOON_TAG_GLASS_SHARED =
  "inline-flex h-8 items-center gap-2 rounded-[5.33px] border-transparent bg-[rgba(18,18,18,0.4)] px-[10.67px] backdrop-blur-[8px]";

const ENDING_SOON_OVERLAY_FRAME =
  "pointer-events-none absolute inset-x-4 bottom-4 z-10 flex @container";
const ENDING_SOON_OVERLAY_POS = "relative max-w-full whitespace-nowrap";
const ENDING_SOON_INLINE_POS =
  "relative inline-flex max-w-full shrink-0 whitespace-nowrap pointer-events-auto";

const ENDING_SOON_COUNTDOWN =
  "min-w-0 tabular-nums text-base font-semibold leading-4 tracking-normal text-brand-100";

const ENDING_SOON_MUTED_SHELL_SHARED =
  "inline-flex h-8 items-center rounded-[5.33px] border-transparent bg-[rgba(18,18,18,0.4)] px-[10.67px] backdrop-blur-[8px] font-supporting text-xs font-medium leading-4 text-brand-100/85";

function ariaLabelFor(state: LotTimerState, timer?: TimerText): string {
  switch (state.kind) {
    case "live":
      if (timer?.date) return `Live auction. Ends ${timer.date}.`;
      return timer ? `Live auction. Ends in ${timer.words}.` : "Live auction.";
    case "opensSoon":
      if (timer?.date) return `Opens ${timer.date}.`;
      return timer ? `Opens in ${timer.words}.` : "Opening soon.";
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
export type LotTimerPillLayout = "overlay" | "inline";

/** Frame width from which the countdown is told in words; narrower, as a clock or short form. */
const WORDS_FIT = {
  default: "@[14rem]:inline hidden",
  endingSoon: "@[15rem]:inline hidden",
} as const;
const COMPACT_FIT = {
  default: "@[14rem]:hidden",
  endingSoon: "@[15rem]:hidden",
} as const;

/**
 * A timer value that never wraps: in words ("42 minutes 10 seconds") when the frame has room,
 * otherwise in the clock or short form ("42:09", "5h 12m"). Tabular numerals keep the width still
 * while seconds tick. A date has one form and always shows.
 */
function Value({
  timer,
  kind,
  inline,
}: { timer: TimerText; kind: keyof typeof WORDS_FIT; inline: boolean }) {
  if (timer.date || timer.words === timer.compact || inline) {
    return <span className="tabular-nums">{timer.date ?? timer.words}</span>;
  }
  return (
    <>
      <span className={cn("tabular-nums", WORDS_FIT[kind])}>{timer.words}</span>
      <span className={cn("tabular-nums", COMPACT_FIT[kind])}>{timer.compact}</span>
    </>
  );
}

export function LotTimerPill({
  state,
  timer,
  surfaceClassName,
  variant = "default",
  layout = "overlay",
  useOverlayChrome = false,
}: {
  state: LotTimerState;
  timer?: TimerText;
  /** Merged last so marketing surfaces can override shell (e.g. glass pill). */
  surfaceClassName?: string;
  variant?: LotTimerPillVariant;
  /** `overlay` positions on image cards; `inline` participates in document flow. */
  layout?: LotTimerPillLayout;
  /** Read `--overlay-*` vars from AdaptiveMediaFrame instead of theme glass. */
  useOverlayChrome?: boolean;
}) {
  const overlayTone = useOverlayTone("bottomLeft");
  const overlayShell = useOverlayChrome ? overlayPillClasses(overlayTone) : null;
  const overlayProps = useOverlayChrome ? overlayToneProps(overlayTone) : {};
  const aria = ariaLabelFor(state, timer);
  const figma = variant === "endingSoon";
  const inline = layout === "inline";

  const shellClass = (
    figmaShell: string,
    figmaPos: string,
    themeShell: string,
    themePos: string,
  ) => {
    if (useOverlayChrome && !figma) {
      return cn(themePos, PILL_BASE_SHARED, overlayShell, themeShell, surfaceClassName);
    }
    if (figma) {
      return cn(inline ? ENDING_SOON_INLINE_POS : figmaPos, figmaShell, surfaceClassName);
    }
    return cn(inline ? PILL_INLINE_POS : themePos, PILL_BASE_SHARED, themeShell, surfaceClassName);
  };

  const toneProps = useOverlayChrome && !figma ? overlayProps : {};
  const place = (pill: ReactNode) =>
    inline ? (
      pill
    ) : (
      <div className={figma ? ENDING_SOON_OVERLAY_FRAME : PILL_OVERLAY_FRAME}>{pill}</div>
    );
  const kind = figma ? "endingSoon" : "default";

  switch (state.kind) {
    case "live":
      return place(
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(
            ENDING_SOON_TAG_GLASS_SHARED,
            ENDING_SOON_OVERLAY_POS,
            SHELL_LIVE,
            PILL_OVERLAY_POS,
          )}
          {...toneProps}
        >
          <LiveDot size="sm" className={figma ? "live-dot-pulse" : ""} />
          {figma ? (
            <span className={ENDING_SOON_COUNTDOWN} aria-hidden>
              {timer ? (
                <>
                  {timer.date ? <span className={WORDS_FIT.endingSoon}>Ends </span> : null}
                  <Value timer={timer} kind={kind} inline={inline} />
                </>
              ) : (
                "—"
              )}
            </span>
          ) : (
            <span className="min-w-0" aria-hidden>
              <span>{timer?.date ? "Live · ends " : "Live · "}</span>
              {timer ? <Value timer={timer} kind={kind} inline={inline} /> : "—"}
            </span>
          )}
        </output>,
      );
    case "opensSoon":
      return place(
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(
            ENDING_SOON_TAG_GLASS_SHARED,
            ENDING_SOON_OVERLAY_POS,
            SHELL_LIVE,
            PILL_OVERLAY_POS,
          )}
          {...toneProps}
        >
          <Clock
            className={cn(
              "shrink-0",
              figma ? "size-4 text-brand-100" : "size-3.5 text-accent-brand",
            )}
            aria-hidden
          />
          {figma ? (
            <span className={ENDING_SOON_COUNTDOWN} aria-hidden>
              {timer ? (
                <>
                  {timer.date ? <span className={WORDS_FIT.endingSoon}>Opens </span> : null}
                  <Value timer={timer} kind={kind} inline={inline} />
                </>
              ) : (
                "—"
              )}
            </span>
          ) : (
            <span className="min-w-0" aria-hidden>
              <span>{timer?.date ? "Opens " : "Opens in "}</span>
              {timer ? <Value timer={timer} kind={kind} inline={inline} /> : "—"}
            </span>
          )}
        </output>,
      );
    case "closed":
      return place(
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(
            ENDING_SOON_MUTED_SHELL_SHARED,
            ENDING_SOON_OVERLAY_POS,
            SHELL_MUTED,
            PILL_OVERLAY_POS,
          )}
          {...toneProps}
        >
          Closed
        </output>,
      );
    case "cancelled":
      return place(
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(
            ENDING_SOON_MUTED_SHELL_SHARED,
            ENDING_SOON_OVERLAY_POS,
            SHELL_MUTED,
            PILL_OVERLAY_POS,
          )}
          {...toneProps}
        >
          Cancelled
        </output>,
      );
    case "unknown":
      return place(
        <output
          aria-live="off"
          aria-label={aria}
          className={shellClass(
            ENDING_SOON_MUTED_SHELL_SHARED,
            ENDING_SOON_OVERLAY_POS,
            SHELL_MUTED,
            PILL_OVERLAY_POS,
          )}
          {...toneProps}
        >
          Soon
        </output>,
      );
    default:
      return assertNever(state);
  }
}
