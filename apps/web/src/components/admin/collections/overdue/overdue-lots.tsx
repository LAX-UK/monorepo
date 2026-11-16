"use client";

import { NOT_COLLECTED_COPY } from "@/lib/admin/collections/not-collected-copy";
import { type OverdueRowView, overdueRowView } from "@/lib/admin/collections/not-collected.vm";
import { notify } from "@/lib/ui/notify";
import {
  DisabledReason,
  EmptyState,
  Notice,
  Section,
  StaffButton,
  StatusBadge,
} from "@auction/staff-ui";
import type { StaffOverdueLot, StaffOverdueLots } from "@auction/types";
import { useState } from "react";
import { ExtendStorageDialog } from "./extend-storage-dialog";
import { WaiveStorageDialog } from "./waive-storage-dialog";

const C = NOT_COLLECTED_COPY;

type Props = {
  overdue: StaffOverdueLots;
  /** Fulfilment and Administrators: extend free storage. */
  canExtend: boolean;
  /** Finance and Administrators: waive charges. */
  canWaive: boolean;
};

type Open = { kind: "extend" | "waive"; lot: StaffOverdueLot; key: number } | null;

/**
 * Collections › Not collected: the lots still here after their collect-by day, longest over first,
 * with what their storage comes to so far (what would be due while charging is off), their band and
 * a flag at 60 days for a personal follow-up. Fulfilment extends free storage and Finance waives
 * charges, each with a reason; the buyer's page reads the change at once.
 */
export function OverdueLots({ overdue: initial, canExtend, canWaive }: Props) {
  const [overdue, setOverdue] = useState(initial);
  const [open, setOpen] = useState<Open>(null);
  const now = new Date(`${overdue.today}T12:00:00Z`);
  const rows = overdue.lots.map((lot) => ({ lot, view: overdueRowView(lot, now) }));

  const show = (kind: "extend" | "waive", lot: StaffOverdueLot) =>
    setOpen((current) => ({ kind, lot, key: (current?.key ?? 0) + 1 }));

  const saved = (next: StaffOverdueLots, toast: string) => {
    setOverdue(next);
    setOpen(null);
    notify.success(toast);
  };

  const dialog =
    open?.kind === "extend" ? (
      <ExtendStorageDialog
        key={open.key}
        venueId={overdue.venueId}
        lotId={open.lot.lotId}
        lotLine={C.row.lotLine(open.lot.lotNumber, open.lot.title)}
        maxDays={open.lot.extensionDaysLeft}
        onClose={() => setOpen(null)}
        onSaved={(next) =>
          saved(next, C.extend.toast(C.row.lotLine(open.lot.lotNumber, open.lot.title)))
        }
      />
    ) : open?.kind === "waive" ? (
      <WaiveStorageDialog
        key={open.key}
        venueId={overdue.venueId}
        lotId={open.lot.lotId}
        lotLine={C.row.lotLine(open.lot.lotNumber, open.lot.title)}
        amount={overdueRowView(open.lot, now).storage}
        onClose={() => setOpen(null)}
        onSaved={(next) =>
          saved(next, C.waive.toast(C.row.lotLine(open.lot.lotNumber, open.lot.title)))
        }
      />
    ) : null;

  return (
    <Section title={C.section.title} description={C.section.description}>
      {rows.length === 0 ? (
        <EmptyState size="compact" title={C.empty.title} description={C.empty.body} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-staff-sm text-staff-muted">{C.section.count(rows.length)}</p>
          {overdue.chargingOn ? null : (
            <Notice tone="info" title={C.chargingOff.title}>
              {C.chargingOff.body}
            </Notice>
          )}
          {overdue.more ? (
            <Notice tone="info" title={C.section.count(rows.length)}>
              {C.section.more}
            </Notice>
          ) : null}
          <ul className="flex flex-col divide-y divide-staff-line rounded-staff-md border border-staff-line bg-staff-surface">
            {rows.map(({ lot, view }) => (
              <OverdueRow
                key={lot.lotId}
                view={view}
                canExtend={canExtend}
                canWaive={canWaive}
                onExtend={() => show("extend", lot)}
                onWaive={() => show("waive", lot)}
              />
            ))}
          </ul>
        </div>
      )}
      {dialog}
    </Section>
  );
}

export function OverdueRow({
  view,
  canExtend,
  canWaive,
  onExtend,
  onWaive,
}: {
  view: OverdueRowView;
  canExtend: boolean;
  canWaive: boolean;
  onExtend: () => void;
  onWaive: () => void;
}) {
  const reasonId = `extend-reason-${view.lotId}`;
  const showWaive = canWaive && view.canWaive;
  return (
    <li
      className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between md:gap-6"
      aria-label={view.lotLine}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-staff-sm font-semibold text-staff-fg tabular-nums">
            {view.daysOver}
          </span>
          {view.followUp ? <StatusBadge tone="warning">{C.row.followUp}</StatusBadge> : null}
          {view.waived ? <StatusBadge tone="neutral">{C.row.waivedBadge}</StatusBadge> : null}
        </div>
        <p className="break-words text-staff-sm text-staff-fg">{view.lotLine}</p>
        <p className="break-words text-staff-sm text-staff-muted">{view.collectBy}</p>
        {view.followUp ? (
          <p className="text-staff-xs text-staff-muted">{C.row.followUpHint}</p>
        ) : null}
        {view.extendedNote ? (
          <p className="text-staff-xs text-staff-muted">{view.extendedNote}</p>
        ) : null}
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-staff-sm">
          <dt className="text-staff-muted">{C.row.storageLabel}</dt>
          <dd className="min-w-0 text-staff-fg">
            <span className="font-medium tabular-nums">{view.storage}</span>
            {view.storageDetail ? (
              <span className="block text-staff-xs text-staff-muted">{view.storageDetail}</span>
            ) : null}
          </dd>
          <dt className="text-staff-muted">{C.row.bandLabel}</dt>
          <dd className="text-staff-fg">{view.band}</dd>
        </dl>
      </div>
      {canExtend || showWaive ? (
        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <div className="flex flex-wrap gap-2">
            {canExtend ? (
              <StaffButton
                variant="secondary"
                size="sm"
                onClick={view.extendBlocked ? undefined : onExtend}
                {...(view.extendBlocked
                  ? { disabledReason: view.extendBlocked, "aria-describedby": reasonId }
                  : {})}
              >
                {C.actions.extend}
              </StaffButton>
            ) : null}
            {showWaive ? (
              <StaffButton variant="secondary" size="sm" onClick={onWaive}>
                {C.actions.waive}
              </StaffButton>
            ) : null}
          </div>
          {canExtend && view.extendBlocked ? (
            <DisabledReason id={reasonId}>{view.extendBlocked}</DisabledReason>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
