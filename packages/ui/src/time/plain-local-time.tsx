import type { MomentDescription } from "@auction/datetime";
import { Globe } from "lucide-react";
import { cn } from "../lib/utils.js";

/**
 * The visitor's time as plain text, for rows that are links: "17:00 in Cairo". A different day
 * keeps the info tint and the named day, so the day is never told by colour alone. A hidden
 * "Your time:" says whose clock it is.
 */
export function PlainLocalTime({ moment }: { moment: MomentDescription }) {
  const local = moment.local;
  if (!local) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-lax text-lax-13 leading-5 tabular-nums",
        moment.localDiffersDay
          ? "rounded-lax-badge bg-lax-info-bg px-1.5 text-lax-info-fg"
          : "text-lax-muted",
      )}
    >
      <span className="sr-only">Your time: </span>
      <Globe aria-hidden className="size-3.5 shrink-0" />
      <time dateTime={moment.iso}>
        {moment.localDiffersDay ? (
          <>
            <b className="font-semibold">{local.day}</b>, {local.time} in {local.city}
          </>
        ) : (
          <>
            <b className="font-medium text-lax-fg">{local.time}</b> in {local.city}
          </>
        )}
      </time>
    </span>
  );
}
