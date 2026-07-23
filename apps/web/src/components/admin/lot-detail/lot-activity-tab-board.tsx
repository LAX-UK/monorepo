"use client";

import { DetailActivityFeed, DetailBoardShell } from "@/components/admin/catalog/detail-board";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { useMemo } from "react";

type Props = {
  lotId: string;
  events: readonly AdminDomainEventRow[];
};

export function LotActivityTabBoard({ lotId: _lotId, events }: Props) {
  const rows = useMemo(
    () =>
      events.map((event) => {
        const when = formatAdminTableDateTime(event.occurredAt, "timestamp");
        return {
          id: event.id,
          label: domainEventLabel(event.eventType),
          detail: when.secondary ?? when.title,
          when: when.primary,
        };
      }),
    [events],
  );

  return (
    <DetailBoardShell
      title="Activity"
      description="Audit trail and lifecycle events for this lot."
      count={rows.length}
    >
      <DetailActivityFeed
        rows={rows}
        title="Lot activity"
        emptyMessage="No activity recorded for this lot yet."
      />
    </DetailBoardShell>
  );
}
