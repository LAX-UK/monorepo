"use client";

import { CookieDockSlot } from "@/components/marketing/consent/cookie-dock";
import { useOutOfView } from "@/hooks/use-out-of-view";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { PhoneBarLine, PhoneBarSummary, PhoneBarTone } from "@/lib/lot-page/phone-bar";
import { useCountdown } from "@/lib/time/use-clock";
import type { CountdownContext, CountdownDisplay } from "@auction/domain";
import type { LotStatusTone } from "@auction/domain";
import { useClaimBottomSlot } from "@auction/marketing-ui/bottom-bar/bottom-slot";
import { laxDensityAttributes } from "@auction/ui/lax/density-attributes";
import { cn } from "@auction/ui/lib/utils";
import { Clock } from "lucide-react";
import type { ReactNode, RefObject } from "react";

/** Room the bar takes at the bottom edge; the in-page action counts as hidden under it. */
const BAR_STRIP_PX = 88;

const TONE_CLASS: Readonly<Record<PhoneBarTone, string>> = {
  calm: "text-lax-muted",
  soon: "text-lax-warning-fg",
  final: "text-lax-danger",
};

const LABEL_TONE_CLASS: Readonly<Record<LotStatusTone, string>> = {
  neutral: "text-lax-muted",
  info: "text-lax-info-fg",
  success: "text-lax-success-fg font-medium",
  warning: "text-lax-warning-fg font-medium",
  danger: "text-lax-danger-fg font-medium",
};

/** Words when the column has room, otherwise the clock or short form, so the line never wraps. */
const WORDS_FIT = "hidden @[12.5rem]:inline";
const COMPACT_FIT = "@[12.5rem]:hidden";

/** Module constants, so the clock does not resubscribe on every render. */
const CONTEXTS: Readonly<Record<string, CountdownContext>> = {
  plain: {},
  extended: { extended: true },
  reduced: { reducedMotion: true },
  extendedReduced: { extended: true, reducedMotion: true },
};

type LineFace = Pick<PhoneBarLine, "words" | "compact" | "tone">;

/** What the line prints for the clock's answer; the server's own text until the clock runs. */
function faceOf(line: PhoneBarLine, display: CountdownDisplay | null): LineFace {
  const c = line.countdown;
  if (!c || !display) return line;
  switch (display.kind) {
    case "date":
      return { words: c.dateText, compact: c.dateText, tone: "calm" };
    case "closing":
      return c.kind === "closes"
        ? { words: "Closing…", compact: "Closing…", tone: "final" }
        : { words: "Opening…", compact: "Opening…", tone: "calm" };
    case "counting":
      return c.kind === "closes"
        ? { words: `${display.text} left`, compact: display.text, tone: display.tone }
        : { words: `Opens in ${display.text}`, compact: display.text, tone: "calm" };
    default:
      return line;
  }
}

/** A line that counts is its own small component, so only it redraws as the seconds change. */
function CountingLine({ line }: { line: PhoneBarLine }) {
  const reduced = useReducedMotion();
  const c = line.countdown;
  const key = c?.extended
    ? reduced
      ? "extendedReduced"
      : "extended"
    : reduced
      ? "reduced"
      : "plain";
  const display = useCountdown(c?.targetMs ?? Number.NaN, "lotBar", {
    ctx: CONTEXTS[key] as CountdownContext,
  });
  return <LineText line={line} face={faceOf(line, display)} />;
}

function LineText({ line, face }: { line: PhoneBarLine; face: LineFace }) {
  return (
    <p
      className={cn(
        "m-0 flex items-center gap-1.5 whitespace-nowrap text-lax-13 leading-5 tabular-nums",
        TONE_CLASS[face.tone],
      )}
    >
      {line.clock ? <Clock aria-hidden className="size-3.5 shrink-0" /> : null}
      {face.words === face.compact ? (
        <span className="truncate">{face.words}</span>
      ) : (
        <>
          <span className={WORDS_FIT}>{face.words}</span>
          <span className={COMPACT_FIT}>{face.compact}</span>
        </>
      )}
    </p>
  );
}

function Line({ line }: { line: PhoneBarLine }) {
  // The bar's line repeats the time row above it, which a screen reader already has.
  return line.countdown ? (
    <div aria-hidden>
      <CountingLine line={line} />
    </div>
  ) : (
    <LineText line={line} face={line} />
  );
}

/**
 * The sticky bar on phones: the figure, the time and the one action for this moment of the lot. It
 * lives in the cookie dock, stacked under the banner, and appears only once the same action in the
 * page has scrolled out of view. While it shows it holds the shared bottom slot, so the docked tab
 * bar steps aside (the two are never stacked) and comes back when the bid panel does. It is a
 * labelled region, not a dialog, so focus is never trapped.
 */
export function LotPhoneBar({
  summary,
  target,
  children,
}: {
  summary: PhoneBarSummary;
  /** The in-page action this bar stands in for. */
  target: RefObject<Element | null>;
  /** The action: a button or a link. */
  children: ReactNode;
}) {
  const outOfView = useOutOfView(target, BAR_STRIP_PX);
  useClaimBottomSlot("lot-phone-bar", outOfView);
  if (!outOfView) return null;
  return (
    <CookieDockSlot>
      <section
        aria-label="Bidding"
        {...laxDensityAttributes("client")}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-lax-line bg-lax-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] font-lax text-lax-fg shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.18)] md:hidden"
      >
        <div className="@container min-w-0">
          <p className="m-0 flex items-baseline gap-1.5 whitespace-nowrap">
            <span
              className={cn(
                "min-w-0 truncate text-lax-13 leading-5",
                LABEL_TONE_CLASS[summary.labelTone],
              )}
            >
              {summary.label}
            </span>
            {summary.amount ? (
              <span className="shrink-0 text-lax-16 leading-6 font-semibold tabular-nums">
                {summary.amount}
              </span>
            ) : null}
          </p>
          {summary.line ? <Line line={summary.line} /> : null}
        </div>
        {children}
      </section>
    </CookieDockSlot>
  );
}
