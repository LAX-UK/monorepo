"use client";

import {
  type AdminTableDateTimeDeadlineKind,
  type AdminTableDateTimeMode,
  formatAdminTableDateTime,
} from "@/lib/admin/format-admin-table-datetime";
import { cn } from "@auction/ui";
import { useEffect, useMemo, useState } from "react";

type Props = {
  iso: string | Date | null | undefined;
  mode: AdminTableDateTimeMode;
  /** Tick primary line for active future deadlines (60s interval). */
  live?: boolean;
  deadlineKind?: AdminTableDateTimeDeadlineKind;
  className?: string;
};

function coerceIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function AdminTableDateTimeCell({
  iso,
  mode,
  live = false,
  deadlineKind = "end",
  className,
}: Props) {
  const isoValue = coerceIso(iso);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!live || !isoValue || mode !== "deadline") return;
    const targetMs = new Date(isoValue).getTime();
    if (!Number.isFinite(targetMs) || targetMs <= Date.now()) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [isoValue, live, mode]);

  const presentation = useMemo(
    () =>
      formatAdminTableDateTime(isoValue, mode, {
        now: new Date(nowMs),
        deadlineKind,
      }),
    [isoValue, mode, nowMs, deadlineKind],
  );

  if (!isoValue) {
    return <span className={cn("font-label text-sm text-on-surface-variant", className)}>—</span>;
  }

  const primaryClass =
    presentation.urgency === "soon"
      ? "text-warning"
      : presentation.urgency === "past"
        ? "text-on-surface-variant"
        : "text-on-surface";

  return (
    <time
      dateTime={presentation.iso ?? undefined}
      title={presentation.title}
      className={cn("block min-w-0", className)}
    >
      <span
        className={cn("block whitespace-nowrap font-label text-sm tabular-nums", primaryClass)}
        suppressHydrationWarning
      >
        {presentation.primary}
      </span>
      {presentation.secondary ? (
        <span className="block whitespace-nowrap font-label text-[11px] tabular-nums text-on-surface-variant">
          {presentation.secondary}
        </span>
      ) : null}
    </time>
  );
}
