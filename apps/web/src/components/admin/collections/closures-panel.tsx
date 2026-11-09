"use client";

import { removeCollectionExceptionAction } from "@/lib/actions/admin/admin-collections";
import { type ExceptionDraft, emptyExceptionDraft } from "@/lib/admin/collections/collection-forms";
import {
  EXCEPTION_SOURCE_LABELS,
  describeException,
  formatExceptionDays,
} from "@/lib/admin/collections/collections.vm";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  EmptyState,
  Notice,
  StaffButton,
  StatusBadge,
} from "@auction/staff-ui";
import { Plus, Trash2 } from "@auction/staff-ui/icons";
import type { StaffCollectionException, StaffCollectionSettings } from "@auction/types";
import type { AffectedBookingsChoice } from "@auction/validators";
import { useCallback, useState } from "react";
import { AddExceptionDialog } from "./add-exception-dialog";
import { AffectedBookingsDialog } from "./affected-bookings-dialog";
import { useCollectionChange } from "./use-collection-change";

type Props = {
  settings: StaffCollectionSettings;
  canChange: boolean;
  today: string;
};

/**
 * The days and times the gallery is closed or opens specially: bank holidays (added
 * automatically for England and Wales), sale days (worked out from the sales at this place) and
 * what staff add. Bank holidays and staff entries can be removed; a sale day can only be opened
 * by adding an extra opening for it.
 */
export function ClosuresPanel({ settings, canChange, today }: Props) {
  /** The form being filled in, or null when no dialog is open. */
  const [adding, setAdding] = useState<ExceptionDraft | null>(null);
  const [removing, setRemoving] = useState<StaffCollectionException | null>(null);
  const upcoming = settings.exceptions.filter((e) => e.endsOn >= today);

  return (
    <div className="flex flex-col gap-4">
      {settings.closeOnSaleDays && settings.nextSaleDay ? (
        <Notice tone="info" title="Sale days close collections">
          {settings.nextSaleDay.saleTitle} is the next sale here. To collect on a sale day, choose
          Open anyway on its row.
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-staff-sm text-staff-muted">
          {upcoming.length === 0
            ? "Nothing coming up."
            : `${upcoming.length} ${upcoming.length === 1 ? "day or run of days" : "days or runs of days"} coming up`}
        </p>
        {canChange ? (
          <div className="flex flex-wrap items-center gap-2">
            <StaffButton
              variant="secondary"
              onClick={() => setAdding({ ...emptyExceptionDraft(today), kind: "extra_opening" })}
            >
              Add extra opening
            </StaffButton>
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setAdding(emptyExceptionDraft(today))}
            >
              Add closure
            </StaffButton>
          </div>
        ) : null}
      </div>

      {upcoming.length === 0 ? (
        <EmptyState
          title="No closures or extra openings"
          description="Bank holidays and sale days appear here as they come up."
          size="compact"
        />
      ) : (
        <ul
          aria-label="Closures and extra openings"
          className="divide-y divide-staff-line-subtle rounded-staff-md border border-staff-line"
        >
          {upcoming.map((exception) => (
            <ExceptionRow
              key={exception.id ?? `${exception.source}-${exception.startsOn}`}
              exception={exception}
              canRemove={canChange && exception.canRemove}
              onRemove={() => setRemoving(exception)}
              onOpenAnyway={
                canChange && exception.source === "sale"
                  ? () =>
                      setAdding({
                        ...emptyExceptionDraft(today),
                        kind: "extra_opening",
                        startsOn: exception.startsOn < today ? today : exception.startsOn,
                        endsOn: exception.endsOn,
                      })
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      {canChange && adding ? (
        <AddExceptionDialog
          key={`${adding.kind}-${adding.startsOn}-${adding.endsOn}`}
          open
          onOpenChange={(next) => {
            if (!next) setAdding(null);
          }}
          venueId={settings.venueId}
          today={today}
          initial={adding}
        />
      ) : null}
      {removing ? (
        <RemoveExceptionFlow
          venueId={settings.venueId}
          exception={removing}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

function ExceptionRow({
  exception,
  canRemove,
  onRemove,
  onOpenAnyway,
}: {
  exception: StaffCollectionException;
  canRemove: boolean;
  onRemove: () => void;
  /** For a sale day: add an extra opening for it. */
  onOpenAnyway: (() => void) | undefined;
}) {
  const days = formatExceptionDays(exception);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-staff-sm font-medium text-staff-fg">{days}</span>
        <span className="text-staff-sm text-staff-muted">
          {describeException(exception)}
          {exception.saleTitle ? `. ${exception.saleTitle}` : ""}
          {exception.reason ? `. ${exception.reason}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge tone={exception.kind === "closure" ? "neutral" : "success"}>
          {exception.kind === "closure" ? "Closed" : "Open"}
        </StatusBadge>
        <span className="text-staff-xs text-staff-muted">
          {EXCEPTION_SOURCE_LABELS[exception.source]}
        </span>
        {onOpenAnyway ? (
          <StaffButton size="sm" variant="secondary" onClick={onOpenAnyway}>
            Open anyway
          </StaffButton>
        ) : null}
        {canRemove ? (
          <StaffButton
            size="icon-sm"
            variant="ghost"
            icon={<Trash2 aria-hidden />}
            aria-label={`Remove ${days}`}
            onClick={onRemove}
          />
        ) : null}
      </div>
    </li>
  );
}

/** Removes one entry; when visits rely on it (an extra opening), lists them and asks first. */
function RemoveExceptionFlow({
  venueId,
  exception,
  onClose,
}: {
  venueId: string;
  exception: StaffCollectionException;
  onClose: () => void;
}) {
  const send = useCallback(
    (choice: AffectedBookingsChoice | undefined) =>
      removeCollectionExceptionAction(venueId, exception.id ?? "", {
        ...(choice ? { affectedBookings: choice } : {}),
      }),
    [venueId, exception.id],
  );
  const change = useCollectionChange(send, (result) => {
    onClose();
    notify.success(
      result.cancelled > 0
        ? `Removed. ${result.cancelled} ${result.cancelled === 1 ? "visit" : "visits"} cancelled.`
        : "Removed.",
    );
  });
  const days = formatExceptionDays(exception);
  const showConfirm = change.affected === null;

  return (
    <>
      <ConfirmActionDialog
        open={showConfirm}
        onOpenChange={(next) => {
          if (!next && !change.busy) onClose();
        }}
        title={
          exception.kind === "closure"
            ? `Remove the closure on ${days}?`
            : `Remove the extra opening on ${days}?`
        }
        description={
          exception.kind === "closure"
            ? "Clients will be able to book visits on these days again."
            : "Clients will no longer be able to book visits on these days."
        }
        confirmLabel="Remove"
        tone="danger"
        loading={change.busy}
        onConfirm={() => void change.submit()}
      >
        {change.failure ? (
          <Notice tone="danger" alert title="It couldn't be removed">
            {change.failure.message}
          </Notice>
        ) : null}
      </ConfirmActionDialog>
      <AffectedBookingsDialog
        open={change.affected !== null}
        where="outside the regular hours"
        confirmLabels={{
          keep: "Remove and keep them",
          cancel: (count) => `Remove and email ${count} ${count === 1 ? "client" : "clients"}`,
        }}
        bookings={change.affected ?? []}
        busy={change.busy}
        onConfirm={(choice) => void change.confirm(choice)}
        onCancel={onClose}
      />
    </>
  );
}
