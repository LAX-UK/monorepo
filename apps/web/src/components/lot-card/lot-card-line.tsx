"use client";

import { timerText } from "@/components/lot-timer/format";
import type { LotCardLineModel } from "@/lib/lot-card/lot-card-line";
import { useCountdownTick } from "@/lib/time/use-clock";
import { cn } from "@auction/ui/lib/utils";
import { useRef } from "react";

type Clock = { words: string; compact: string };

function isoMs(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function untilMs(iso: string | null, now: number): number | null {
  if (iso === null) return null;
  const ms = new Date(iso).getTime() - now;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The right-hand part of the line: when the lot opens or closes, or how it ended. A date beyond a
 * week, words within it; in a narrow card the same value shows as a clock ("42:09"), which still
 * ticks. It never wraps.
 */
function clockOf(model: LotCardLineModel, now: number | null): Clock | null {
  if (now === null) return null;
  if (model.time !== "opens" && model.time !== "closes") return null;
  const ms = untilMs(model.time === "opens" ? model.startsAt : model.endsAt, now);
  if (ms === null || ms <= 0) return null;
  const { words, compact, date } = timerText(ms, now);
  if (date) {
    const text = model.time === "opens" ? `Opens ${date}` : `Ends ${date}`;
    return { words: text, compact: text };
  }
  return model.time === "opens"
    ? { words: `Opens in ${words}`, compact: `Opens in ${compact}` }
    : { words: `${words} left`, compact: `${compact} left` };
}

/**
 * One line on a public lot card: the price label and figure, and the time. Narrow
 * cards stack the two. The time keeps to one line: words where they fit, the clock form where
 * they do not.
 */
export function LotCardLine({ model, className }: { model: LotCardLineModel; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const now = useCountdownTick(
    [model.time === "opens" ? isoMs(model.startsAt) : isoMs(model.endsAt)],
    { surface: "card", inViewRef: rootRef },
  );
  const clock = clockOf(model, now);
  return (
    <div
      ref={rootRef}
      className={cn(
        "@container flex min-w-0 flex-col gap-0.5 font-body text-sm leading-5 text-on-surface",
        className,
      )}
      data-testid="lot-card-line"
    >
      <div className="flex min-w-0 flex-col gap-0.5 @[18rem]:flex-row @[18rem]:items-baseline @[18rem]:justify-between @[18rem]:gap-3">
        <p className="m-0 min-w-0 truncate">
          {model.label}
          {model.value ? <b className="ml-1 font-semibold tabular-nums">{model.value}</b> : null}
        </p>
        {clock ? (
          <p className="m-0 whitespace-nowrap text-on-surface-variant tabular-nums">
            <span className="hidden @[14rem]:inline @[18rem]:hidden @[28rem]:inline">
              {clock.words}
            </span>
            <span className="@[14rem]:hidden @[18rem]:inline @[28rem]:hidden">{clock.compact}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
