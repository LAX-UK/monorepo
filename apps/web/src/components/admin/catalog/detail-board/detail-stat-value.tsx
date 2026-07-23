"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import type { DetailStatRow } from "@/lib/admin/detail-board/types";
import { cn } from "@auction/ui";
import { Check } from "lucide-react";

type Props = {
  row: DetailStatRow;
  className?: string;
  showVerified?: boolean;
};

function VerifiedMark({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
        verified ? "bg-positive-container text-positive" : "bg-warning-container text-warning",
      )}
      aria-hidden
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

/** Renders a detail stat value — datetime cell when row carries dateIso, else plain text. */
export function DetailStatValue({ row, className, showVerified = false }: Props) {
  const valueNode = row.dateIso ? (
    <AdminTableDateTimeCell
      iso={row.dateIso}
      mode={row.dateMode ?? "timestamp"}
      {...(row.dateLive !== undefined ? { live: row.dateLive } : {})}
      deadlineKind={row.deadlineKind ?? "end"}
      {...(className !== undefined ? { className } : {})}
    />
  ) : (
    <span className={className ?? "font-medium text-on-surface"}>{row.value}</span>
  );

  if (!showVerified && row.verified == null && !row.gapMessage) {
    return valueNode;
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {showVerified && row.verified != null ? <VerifiedMark verified={row.verified} /> : null}
        {valueNode}
      </div>
      {row.gapMessage ? (
        <p className="max-w-[16rem] text-right font-body text-xs text-warning">{row.gapMessage}</p>
      ) : null}
    </div>
  );
}
