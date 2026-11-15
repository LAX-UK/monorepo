"use client";

import { STORAGE_COPY } from "@/lib/admin/collections/storage-copy";
import {
  historySentence,
  scheduledChanges,
  storageDay,
  termsFacts,
} from "@/lib/admin/collections/storage.vm";
import {
  ChangesTable,
  ChoiceRow,
  type DataColumn,
  DataTable,
  KeyValueList,
  Section,
  StaffButton,
  StaffSwitch,
  formatStaffDateTime,
} from "@auction/staff-ui";
import type {
  StaffStorageCharging,
  StaffStorageHistoryEntry,
  StaffStorageTerms,
} from "@auction/types";
import { useId } from "react";

const C = STORAGE_COPY;

/** The terms buyers are held to today, and the way to schedule the next change. */
export function InForceCard({
  terms,
  today,
  canChange,
  blockedReason,
  onSchedule,
}: {
  terms: StaffStorageTerms;
  today: string;
  canChange: boolean;
  /** Why a new change cannot be scheduled now, when it cannot. */
  blockedReason: string | null;
  onSchedule: () => void;
}) {
  return (
    <Section
      id="storage-in-force"
      title={C.inForce.title}
      description={C.inForce.since(storageDay(terms.effectiveFrom, today))}
      action={
        canChange ? (
          <StaffButton
            size="sm"
            variant="secondary"
            onClick={onSchedule}
            {...(blockedReason ? { disabledReason: blockedReason } : {})}
          >
            {C.inForce.action}
          </StaffButton>
        ) : null
      }
    >
      <KeyValueList items={termsFacts(terms)} />
    </Section>
  );
}

/** The change waiting to start, beside the terms in force, with its reason. */
export function ScheduledCard({
  scheduled,
  inForce,
  today,
  canChange,
  onEdit,
  onCancel,
}: {
  scheduled: StaffStorageTerms;
  inForce: StaffStorageTerms | null;
  today: string;
  canChange: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const from = storageDay(scheduled.effectiveFrom, today);
  return (
    <Section
      id="storage-scheduled"
      title={C.scheduled.title}
      description={C.scheduled.from(from)}
      action={
        canChange ? (
          <>
            <StaffButton size="sm" variant="ghost" onClick={onCancel}>
              {C.scheduled.cancel}
            </StaffButton>
            <StaffButton size="sm" variant="secondary" onClick={onEdit}>
              {C.scheduled.edit}
            </StaffButton>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <ChangesTable
          label={C.scheduled.tableLabel}
          beforeHeading={C.scheduled.before}
          afterHeading={C.scheduled.after(from)}
          rows={scheduledChanges(inForce, scheduled, today)}
        />
        <KeyValueList items={[{ label: C.scheduled.reason, value: scheduled.reason }]} />
      </div>
    </Section>
  );
}

/**
 * "Raise storage invoices": a switch that takes effect at once, after an in-page confirmation.
 * Disabled, with the reason beside it, until a VAT treatment is chosen. Read-only staff see the
 * setting as text.
 */
export function ChargingCard({
  charging,
  canChange,
  busy,
  onSwitch,
}: {
  charging: StaffStorageCharging;
  canChange: boolean;
  busy: boolean;
  onSwitch: (on: boolean) => void;
}) {
  const id = useId();
  const blocked = charging.vatTreatment === null && !charging.raiseInvoices;
  const description = blocked
    ? `${C.charging.explanation} ${C.charging.noVat}`
    : C.charging.explanation;
  return (
    <Section id="storage-charging" title={C.charging.title}>
      {canChange ? (
        <ChoiceRow
          htmlFor={id}
          label={C.charging.switchLabel}
          description={description}
          disabled={blocked || busy}
          control={
            <StaffSwitch
              id={id}
              checked={charging.raiseInvoices}
              disabled={blocked || busy}
              onCheckedChange={(next) => onSwitch(next)}
            />
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <KeyValueList
            items={[
              {
                label: C.charging.switchLabel,
                value: charging.raiseInvoices ? C.status.on : C.status.off,
              },
            ]}
          />
          <p className="text-staff-sm text-staff-muted">{description}</p>
        </div>
      )}
    </Section>
  );
}

/** Every change to the place's terms and switch: when, who, and what, as a plain sentence. */
export function StorageHistory({
  history,
  today,
}: {
  history: readonly StaffStorageHistoryEntry[];
  today: string;
}) {
  const now = new Date(`${today}T12:00:00Z`);
  const columns: DataColumn<StaffStorageHistoryEntry>[] = [
    {
      id: "when",
      header: C.history.columns.when,
      cell: (row) => formatStaffDateTime(row.at, now),
      width: "200px",
      sortValue: (row) => row.at,
      mobile: "meta",
      truncate: false,
    },
    {
      id: "who",
      header: C.history.columns.who,
      cell: (row) => row.who ?? C.history.system,
      width: "180px",
      mobile: "meta",
    },
    {
      id: "change",
      header: C.history.columns.change,
      cell: (row) => (
        <span className="flex flex-col gap-0.5 whitespace-normal">
          <span>{historySentence(row, today)}</span>
          {row.reason ? (
            <span className="text-staff-xs text-staff-muted">{C.history.reason(row.reason)}</span>
          ) : null}
        </span>
      ),
      minWidth: "280px",
      mobile: "title",
      truncate: false,
    },
  ];
  return (
    // The card clips the table's corners; the table draws no border of its own.
    <Section
      id="storage-history"
      title={C.history.title}
      className="overflow-hidden"
      bodyClassName="p-0"
    >
      <DataTable<StaffStorageHistoryEntry>
        embedded
        label={C.history.title}
        columns={columns}
        data={history}
        getRowId={(row) => row.id}
        defaultSort={{ columnId: "when", direction: "desc" }}
        empty={<p className="px-4 py-6 text-staff-sm text-staff-muted">{C.history.empty}</p>}
      />
    </Section>
  );
}
