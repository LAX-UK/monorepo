"use client";

import { CookieDockSlot } from "@/components/marketing/consent/cookie-dock";
import { useOutOfView } from "@/hooks/use-out-of-view";
import type { PhoneBarLine, PhoneBarSummary, PhoneBarTone } from "@/lib/lot-page/phone-bar";
import type { LotStatusTone } from "@auction/domain";
import { useClaimBottomSlot } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { laxDensityAttributes } from "@auction/ui/lax";
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

function Line({ line }: { line: PhoneBarLine }) {
  return (
    <p
      className={cn(
        "m-0 flex items-center gap-1.5 whitespace-nowrap text-lax-13 leading-5 tabular-nums",
        TONE_CLASS[line.tone],
      )}
    >
      {line.clock ? <Clock aria-hidden className="size-3.5 shrink-0" /> : null}
      {line.words === line.compact ? (
        <span className="truncate">{line.words}</span>
      ) : (
        <>
          <span className={WORDS_FIT}>{line.words}</span>
          <span className={COMPACT_FIT}>{line.compact}</span>
        </>
      )}
    </p>
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
