"use client";

import { deviceTimeZone } from "@auction/datetime";
import { ChevronDown, Globe } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils.js";
import { ChangeZoneDialog } from "./change-zone-dialog.js";
import { PlainLocalTime } from "./plain-local-time.js";
import { TimeChipPanel } from "./time-chip-panel.js";
import { useDisclosure } from "./use-disclosure.js";
import { useViewerMoment } from "./use-viewer-moment.js";

export type TimeChipProps = {
  /** The moment, as an ISO instant. */
  instant: string;
  /** The zone the sale quotes its times in. */
  officialZone: string;
  /**
   * `button` is the chip with its panel. `plain` is the same words as text, for a row that is a
   * link already (a button inside a link is not allowed): globe, no border, no chevron.
   */
  variant?: "button" | "plain";
};

/** The panel is 300px wide; nearer the right edge than that it opens towards the left. */
const PANEL_WIDTH_PX = 300;
const EDGE_GUTTER_PX = 16;

/**
 * The visitor's own time for a moment, in a chip under the official time: "20:00 in Cairo", or
 * "Fri 13 Nov, 05:00 in Sydney" with the day named and the info tint when the day differs. It
 * renders nothing when the visitor's clock reads the same or their zone is unknown (UK, UTC).
 * The chip stays neutral however close the close is: urgency belongs to the countdown.
 */
export function TimeChip({ instant, officialZone, variant = "button" }: TimeChipProps) {
  const { viewer, moment } = useViewerMoment(instant, officialZone);
  const at = useMemo(() => new Date(instant), [instant]);
  const panelId = useId();
  const disclosure = useDisclosure();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  // Read when the panel opens: the device's zone is a browser-only value.
  const deviceZone = useMemo(
    () => (disclosure.open && viewer?.source !== "device" ? deviceTimeZone() : null),
    [disclosure.open, viewer?.source],
  );

  useLayoutEffect(() => {
    if (!disclosure.open) return;
    const left = disclosure.rootRef.current?.getBoundingClientRect().left ?? 0;
    setAlignEnd(left + PANEL_WIDTH_PX > window.innerWidth - EDGE_GUTTER_PX);
  }, [disclosure.open, disclosure.rootRef]);

  const local = moment?.local;
  if (!moment || !local || !moment.spoken || !viewer) return null;
  const differsDay = moment.localDiffersDay;

  if (variant === "plain") return <PlainLocalTime moment={moment} />;

  return (
    <span ref={disclosure.rootRef} className="relative flex w-fit max-w-full">
      <button
        ref={disclosure.triggerRef}
        type="button"
        aria-expanded={disclosure.open}
        aria-controls={panelId}
        aria-label={`${moment.spoken} Show details.`}
        onClick={disclosure.toggle}
        className={cn(
          "lax-focus relative inline-flex min-h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-lax-control border px-[7px] py-0.5",
          "font-lax text-lax-13 leading-5 font-normal tabular-nums transition-colors duration-150",
          "after:absolute after:-inset-x-0.5 after:-inset-y-2 after:content-['']",
          differsDay
            ? "border-transparent bg-lax-info-bg text-lax-info-fg"
            : "border-lax-line bg-lax-surface text-lax-muted hover:border-lax-line-hover hover:bg-lax-line-subtle hover:text-lax-fg",
          disclosure.open && !differsDay && "border-lax-line-hover bg-lax-line-subtle text-lax-fg",
        )}
      >
        <Globe aria-hidden className="size-3.5 shrink-0" />
        <span aria-hidden className="text-left">
          {differsDay ? (
            <>
              <b className="font-semibold">{local.day}</b>, {local.time} in {local.city}
            </>
          ) : (
            <>
              <b className="font-medium text-lax-fg">{local.time}</b> in {local.city}
            </>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-3 shrink-0 transition-transform", disclosure.open && "rotate-180")}
        />
      </button>
      {disclosure.open ? (
        <TimeChipPanel
          id={panelId}
          moment={moment}
          officialZone={officialZone}
          source={viewer.source}
          alignEnd={alignEnd}
          deviceZone={deviceZone && deviceZone !== viewer.zone ? deviceZone : null}
          onChangeZone={() => {
            disclosure.close();
            setZoneOpen(true);
          }}
        />
      ) : null}
      <ChangeZoneDialog
        open={zoneOpen}
        onOpenChange={(next) => {
          setZoneOpen(next);
        }}
        current={viewer}
        officialZone={officialZone}
        at={at}
        returnFocusTo={() => disclosure.triggerRef.current}
      />
    </span>
  );
}
