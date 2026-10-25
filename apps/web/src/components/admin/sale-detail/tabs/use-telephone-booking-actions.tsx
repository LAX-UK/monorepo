"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminTelephoneBookingResultAction } from "@/lib/actions/admin";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { decimalToMinorUnits } from "@/lib/data/view-models/client-commerce-tab.vm";
import {
  isTelephoneBookingClosed,
  telephoneBidderLabel,
} from "@/lib/data/view-models/sale-telephone-tab.vm";
import { notify } from "@/lib/ui/notify";
import {
  Field,
  Notice,
  type OverflowAction,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
  formatStaffMoney,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

type Edit = { kind: "clerk" | "notes"; row: AdminTelephoneBookingRow };

const NOTES_MAX = 2000;
const CLERK_MAX = 191;

/** Assigns the clerk who takes a line, or edits the staff notes kept with a booking. */
function BookingEditDialog({
  saleId,
  edit,
  onClose,
}: {
  saleId: string;
  edit: Edit | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(() =>
    edit?.kind === "clerk" ? (edit.row.clerkUserId ?? "") : (edit?.row.notes ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, startTransition] = useTransition();

  const isClerk = edit?.kind === "clerk";
  const bidder = edit ? telephoneBidderLabel(edit.row) : "";

  const validate = (text: string) =>
    isClerk && text.trim() === "" ? "Enter the clerk's user ID." : null;

  const submit = () => {
    if (!edit) return;
    const found = validate(value);
    setError(found);
    setAttempted(true);
    if (found) return;
    setFailure(null);
    startTransition(async () => {
      const result = await adminTelephoneBookingResultAction(
        isClerk
          ? {
              action: "assign-clerk",
              saleId,
              bookingId: edit.row.id,
              clerkUserId: value.trim(),
            }
          : { action: "notes", saleId, bookingId: edit.row.id, notes: value },
      );
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      notify.success(isClerk ? "Clerk assigned" : "Notes saved");
      onClose();
      router.refresh();
    });
  };

  return (
    <StaffDialog
      open={edit !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={isClerk ? `Assign a clerk to ${bidder}` : `Notes for ${bidder}`}
      description={
        isClerk ? "The clerk takes this bidder's line during the sale." : "Visible to staff only."
      }
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={submit}>
            {isClerk ? "Assign clerk" : "Save notes"}
          </StaffButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        {!isClerk && edit?.row.buyerNotes ? (
          <Notice tone="info" title="Note from the bidder">
            {edit.row.buyerNotes}
          </Notice>
        ) : null}
        {isClerk ? (
          <Field
            label="Clerk user ID"
            description="The account ID of the staff member taking the line."
            error={error}
            disabled={busy}
          >
            <TextInput
              value={value}
              maxLength={CLERK_MAX}
              autoComplete="off"
              onChange={(event) => {
                setValue(event.target.value);
                if (attempted) setError(validate(event.target.value));
              }}
            />
          </Field>
        ) : (
          <Field label="Staff notes" optional disabled={busy}>
            <TextArea
              rows={4}
              value={value}
              maxLength={NOTES_MAX}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
        )}
      </form>
    </StaffDialog>
  );
}

/**
 * What staff can do with a telephone booking, from the row's `…` menu: confirm it, approve a
 * higher limit, assign a clerk, keep notes, close the line or cancel it with a reason.
 */
export function useTelephoneBookingActions(saleId: string) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const [edit, setEdit] = useState<Edit | null>(null);

  const actionsFor = useCallback(
    (row: AdminTelephoneBookingRow): OverflowAction[] => {
      const bidder = telephoneBidderLabel(row);
      const open = !isTelephoneBookingClosed(row);
      const limitMinor = decimalToMinorUnits(row.limitIncreaseAmount);
      const run = (action: "confirm" | "close" | "approve-limit-increase") => () =>
        adminTelephoneBookingResultAction({ action, saleId, bookingId: row.id });
      const actions: OverflowAction[] = [];

      if (row.status === "requested") {
        actions.push({
          id: "confirm",
          label: "Confirm booking",
          onSelect: () =>
            ask({
              title: `Confirm ${bidder}'s telephone line?`,
              description: "The bidder is told their line is confirmed.",
              confirmLabel: "Confirm booking",
              run: run("confirm"),
              success: "Booking confirmed",
            }),
        });
      }
      if (open && row.limitIncreaseRequestedAt != null) {
        actions.push({
          id: "limit",
          label: "Approve higher limit",
          onSelect: () =>
            ask({
              title: `Approve a higher limit for ${bidder}?`,
              description:
                limitMinor != null
                  ? `The bidder asked to raise their authorised maximum to ${formatStaffMoney(limitMinor)}.`
                  : "The bidder asked to raise their authorised maximum.",
              confirmLabel: "Approve increase",
              run: run("approve-limit-increase"),
              success: "Limit increase approved",
            }),
        });
      }
      if (open) {
        actions.push({
          id: "clerk",
          label: row.clerkUserId ? "Change clerk" : "Assign clerk",
          onSelect: () => setEdit({ kind: "clerk", row }),
        });
      }
      actions.push({
        id: "notes",
        label: "Edit notes",
        onSelect: () => setEdit({ kind: "notes", row }),
      });
      actions.push({
        id: "client",
        label: "Open client",
        href: `/admin/clients/${encodeURIComponent(row.userId)}`,
      });
      if (open) {
        actions.push({
          id: "close",
          label: "Close line",
          onSelect: () =>
            ask({
              title: `Close ${bidder}'s line?`,
              description: "The line is marked finished and no more lots are bid on it.",
              confirmLabel: "Close line",
              run: run("close"),
              success: "Line closed",
            }),
        });
        actions.push({
          id: "cancel",
          label: "Cancel booking",
          tone: "danger",
          onSelect: () =>
            ask({
              title: `Cancel ${bidder}'s telephone booking?`,
              description: "The bidder is told the booking is cancelled.",
              confirmLabel: "Cancel booking",
              cancelLabel: "Keep booking",
              tone: "danger",
              reason: {
                label: "Reason",
                description: "Kept with the booking.",
                maxLength: 500,
              },
              run: ({ reason }) =>
                adminTelephoneBookingResultAction({
                  action: "cancel",
                  saleId,
                  bookingId: row.id,
                  reason,
                }),
              success: "Booking cancelled",
            }),
        });
      }
      return actions;
    },
    [ask, saleId],
  );

  const dialogs = (
    <>
      {confirm.dialog}
      <BookingEditDialog
        key={edit ? `${edit.kind}-${edit.row.id}` : "closed"}
        saleId={saleId}
        edit={edit}
        onClose={() => setEdit(null)}
      />
    </>
  );

  return { actionsFor, dialogs };
}
