"use client";

import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { LONDON_TIME_ZONE, formatTime } from "@auction/datetime";
import { londonZoneLabel } from "@auction/domain";
import type { CollectionSlotView } from "@auction/types";
import { Button } from "@auction/ui/lax/button";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { cn } from "@auction/ui/lib/utils";
import { RadioGrid, type RadioGridItem } from "./radio-grid";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

function timeClass({ checked, disabled }: { checked: boolean; disabled: boolean }): string {
  return cn(
    "flex min-h-11 flex-col items-center justify-center rounded-lax-control border px-3 py-2 text-lax-14 tabular-nums transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none lax-focus",
    disabled
      ? "cursor-not-allowed border-lax-line bg-lax-sunken text-lax-muted"
      : "border-lax-line-strong bg-lax-surface text-lax-fg hover:border-lax-control-edge",
    checked && "border-lax-ink font-medium shadow-[inset_0_0_0_1px_var(--lax-ink)]",
  );
}

/**
 * The times of the chosen day. A time with no place left reads "Full" and cannot be chosen. While
 * the times are read again the buttons are skeletons of the same size, so nothing moves.
 */
export function CollectTimePicker({
  slots,
  value,
  onValueChange,
  loading,
  failed,
  onRetry,
  hasDay,
  visitMinutes,
}: {
  slots: readonly CollectionSlotView[];
  value: string | null;
  onValueChange: (start: string) => void;
  loading: boolean;
  /** The times could not be read. */
  failed: boolean;
  onRetry: () => void;
  hasDay: boolean;
  visitMinutes: number;
}) {
  const first = slots[0];
  const zone = first ? londonZoneLabel(new Date(first.start)) : null;
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <output className="sr-only">{COLLECT_COPY.time.loading}</output>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-11 rounded-lax-control" />
          ))}
        </div>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-lax-14 text-lax-fg">
          {COLLECT_COPY.time.loadFailed}
        </p>
        <Button onClick={onRetry}>{COLLECT_COPY.time.retry}</Button>
      </div>
    );
  }
  if (!hasDay) return <p className="text-lax-14 text-lax-muted">{COLLECT_COPY.time.noDay}</p>;
  if (slots.length === 0) {
    return <p className="text-lax-14 text-lax-muted">{COLLECT_COPY.time.noneThatDay}</p>;
  }
  const items: RadioGridItem[] = slots.map((slot) => {
    const taken = slot.state !== "open" || slot.placesLeft === 0;
    const time = formatTime(new Date(slot.start), LONDON_TIME_ZONE);
    return {
      id: slot.start,
      label: taken ? `${time}, ${slot.state === "too_soon" ? "too soon" : "full"}` : time,
      disabled: taken,
      className: timeClass,
      content: (
        <>
          <span>{time}</span>
          {taken ? (
            <span className="text-lax-12">
              {slot.state === "too_soon" ? COLLECT_COPY.day.tooSoon : COLLECT_COPY.time.full}
            </span>
          ) : null}
        </>
      ),
    };
  });
  return (
    <div className="flex flex-col gap-3">
      <RadioGrid
        id="collect-time"
        label={COLLECT_COPY.panels.time}
        items={items}
        value={value}
        onValueChange={onValueChange}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      />
      {zone ? (
        <p className="text-lax-13 text-lax-muted">
          London time ({zone}). Each visit is {visitMinutes} minutes.
        </p>
      ) : null}
    </div>
  );
}
