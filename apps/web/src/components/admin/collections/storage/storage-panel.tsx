"use client";

import {
  cancelStorageTermsAction,
  setStorageChargingAction,
} from "@/lib/actions/admin/admin-collection-storage";
import { STORAGE_COPY } from "@/lib/admin/collections/storage-copy";
import { storageDay } from "@/lib/admin/collections/storage.vm";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, EmptyState, Notice, StaffButton } from "@auction/staff-ui";
import type { StaffStorageSettings, StaffStorageTerms } from "@auction/types";
import { useState } from "react";
import { ChargingCard, InForceCard, ScheduledCard, StorageHistory } from "./storage-cards";
import { StorageTermsSheet } from "./storage-terms-sheet";
import { useStorageChange } from "./use-storage-change";

const C = STORAGE_COPY;

type Props = {
  storage: StaffStorageSettings;
  /** Finance and Administrators; everyone else sees the tab read-only. */
  canChange: boolean;
};

/** The sheet, when open: a new change, or the scheduled one being edited. Keyed to start fresh. */
type SheetState = { key: number; editing: StaffStorageTerms | null };

/**
 * Collections › Storage: the terms in force, the change waiting to start, the "Raise storage
 * invoices" switch and the history of changes, for one place. Finance and Administrators schedule,
 * edit and cancel changes and work the switch; the cards stack on a phone.
 */
export function StoragePanel({ storage: initial, canChange }: Props) {
  const [storage, setStorage] = useState(initial);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [switchTo, setSwitchTo] = useState<boolean | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const change = useStorageChange();
  const { inForce, scheduled, charging, history, today, venueId } = storage;

  const openSheet = (editing: StaffStorageTerms | null) =>
    setSheet((current) => ({ key: (current?.key ?? 0) + 1, editing }));

  async function cancelChange(reason: string) {
    if (!scheduled) return;
    const outcome = await change.run(() =>
      cancelStorageTermsAction(venueId, scheduled.id, { reason }),
    );
    if (outcome.ok) {
      setStorage(outcome.settings);
      setCancelling(false);
      notify.success(C.toasts.cancelled);
    } else if (outcome.failure) {
      setCancelling(false);
      setFailure(outcome.failure.message);
    }
  }

  async function switchCharging(raiseInvoices: boolean, reason: string) {
    const outcome = await change.run(() =>
      setStorageChargingAction(venueId, { raiseInvoices, reason }),
    );
    setSwitchTo(null);
    if (outcome.ok) {
      setStorage(outcome.settings);
      notify.success(raiseInvoices ? C.toasts.chargingOn : C.toasts.chargingOff);
    } else if (outcome.failure) {
      setFailure(outcome.failure.message);
    }
  }

  const sheetView = sheet ? (
    <StorageTermsSheet
      key={sheet.key}
      onClose={() => setSheet(null)}
      venueId={venueId}
      today={today}
      inForce={inForce}
      editing={sheet.editing}
      onSaved={(next) => {
        setStorage(next);
        setSheet(null);
        setFailure(null);
        notify.success(sheet.editing ? C.toasts.edited : C.toasts.scheduled);
      }}
    />
  ) : null;

  if (!inForce && !scheduled) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          title={C.empty.title}
          description={C.empty.body}
          action={
            canChange ? (
              <StaffButton variant="primary" onClick={() => openSheet(null)}>
                {C.empty.action}
              </StaffButton>
            ) : null
          }
        />
        {history.length > 0 ? <StorageHistory history={history} today={today} /> : null}
        {sheetView}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {charging.raiseInvoices ? null : (
        <Notice tone="info" title={C.offNotice.title}>
          {C.offNotice.body}
        </Notice>
      )}
      {failure ? (
        <Notice tone="danger" alert title={C.failed}>
          {failure}
        </Notice>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {inForce ? (
          <InForceCard
            terms={inForce}
            today={today}
            canChange={canChange}
            blockedReason={scheduled ? C.inForce.actionBlocked : null}
            onSchedule={() => openSheet(null)}
          />
        ) : null}
        {scheduled ? (
          <ScheduledCard
            scheduled={scheduled}
            inForce={inForce}
            today={today}
            canChange={canChange}
            onEdit={() => openSheet(scheduled)}
            onCancel={() => setCancelling(true)}
          />
        ) : null}
        <ChargingCard
          charging={charging}
          canChange={canChange}
          busy={change.busy}
          onSwitch={(on) => setSwitchTo(on)}
        />
      </div>
      <StorageHistory history={history} today={today} />

      {scheduled ? (
        <ConfirmActionDialog
          open={cancelling}
          onOpenChange={(open) => {
            if (!change.busy) setCancelling(open);
          }}
          title={C.scheduled.confirm.title(storageDay(scheduled.effectiveFrom, today))}
          description={C.scheduled.confirm.body}
          confirmLabel={C.scheduled.confirm.confirm}
          cancelLabel={C.scheduled.confirm.keep}
          tone="danger"
          loading={change.busy}
          reason={{
            label: C.scheduled.confirm.reasonLabel,
            description: C.scheduled.confirm.reasonHint,
            missingMessage: C.scheduled.confirm.reasonMissing,
          }}
          onConfirm={({ reason }) => void cancelChange(reason)}
        />
      ) : null}
      <ConfirmActionDialog
        open={switchTo !== null}
        onOpenChange={(open) => {
          if (!open && !change.busy) setSwitchTo(null);
        }}
        title={switchTo ? C.charging.on.title : C.charging.off.title}
        description={switchTo ? C.charging.on.body : C.charging.off.body}
        confirmLabel={switchTo ? C.charging.on.confirm : C.charging.off.confirm}
        loading={change.busy}
        reason={{
          label: C.charging.reasonLabel,
          description: C.charging.reasonHint,
          missingMessage: C.charging.reasonMissing,
        }}
        onConfirm={({ reason }) => void switchCharging(switchTo === true, reason)}
      />
      {sheetView}
    </div>
  );
}
