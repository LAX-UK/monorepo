"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import {
  adminTelephoneBookingApproveLimitIncreaseAction,
  adminTelephoneBookingAssignClerkAction,
  adminTelephoneBookingCancelAction,
  adminTelephoneBookingCloseAction,
  adminTelephoneBookingConfirmAction,
  adminTelephoneBookingNotesAction,
} from "@/lib/actions/admin";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingDotStatus } from "@/lib/presenters/status/dot-status-presenters";
import { formatMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";

type Props = {
  saleId: string;
  row: AdminTelephoneBookingRow;
};

export function TelephoneBookingActionCard({ saleId, row }: Props) {
  const pendingConfirm = row.status === "requested";
  const pendingLimit = row.limitIncreaseRequestedAt != null;

  return (
    <div className="rounded-lg border border-shell-stroke bg-surface-container-low/30 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{row.userName ?? row.userEmail ?? row.userId}</p>
          {row.userEmail ? (
            <p className="font-body text-xs text-on-surface-variant">{row.userEmail}</p>
          ) : null}
          {row.buyerLegalEntityDisplayName ? (
            <p className="font-body text-xs text-on-surface-variant">
              Entity: {row.buyerLegalEntityDisplayName}
            </p>
          ) : null}
          <p className="font-body text-xs text-on-surface-variant">
            Phone:{" "}
            <a
              href={`tel:${row.phoneE164}`}
              className="text-link underline-offset-2 hover:underline"
            >
              {row.phoneDisplay ?? row.phoneE164}
            </a>
          </p>
          {row.authorizedMax ? (
            <p className="font-body text-xs text-on-surface-variant">
              Authorized max: {formatMoney(row.authorizedMax)}
            </p>
          ) : null}
          {row.buyerNotes ? (
            <p className="font-body text-xs text-on-surface-variant">
              Buyer notes: {row.buyerNotes}
            </p>
          ) : null}
          <p className="inline-flex flex-wrap items-center gap-1 font-body text-xs text-on-surface-variant">
            Requested: <AdminTableDateTimeCell iso={row.createdAt} mode="timestamp" />
          </p>
        </div>
        {(() => {
          const presentation = telephoneBookingDotStatus(row.status);
          return <DotStatusPill label={presentation.label} tone={presentation.tone} />;
        })()}
      </div>

      {pendingLimit ? (
        <Alert>
          <AlertTitle>Limit increase requested</AlertTitle>
          <AlertDescription>
            {row.limitIncreaseAmount
              ? `Buyer requested ${formatMoney(row.limitIncreaseAmount)}.`
              : "Awaiting approval."}
          </AlertDescription>
          <form action={adminTelephoneBookingApproveLimitIncreaseAction} className="mt-3">
            <input type="hidden" name="saleId" value={saleId} />
            <input type="hidden" name="bookingId" value={row.id} />
            <Button type="submit" size="sm">
              Approve increase
            </Button>
          </form>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {pendingConfirm ? (
          <form action={adminTelephoneBookingConfirmAction}>
            <input type="hidden" name="saleId" value={saleId} />
            <input type="hidden" name="bookingId" value={row.id} />
            <Button type="submit" size="sm">
              Confirm
            </Button>
          </form>
        ) : null}
        {row.status !== "cancelled" && row.status !== "completed" ? (
          <>
            <form
              action={adminTelephoneBookingAssignClerkAction}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="saleId" value={saleId} />
              <input type="hidden" name="bookingId" value={row.id} />
              <div className="space-y-1">
                <Label htmlFor={`clerk-${row.id}`} className="text-xs">
                  Clerk user id
                </Label>
                <Input
                  id={`clerk-${row.id}`}
                  name="clerkUserId"
                  defaultValue={row.clerkUserId ?? ""}
                  className="h-9 w-44 font-body text-sm"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Assign clerk
              </Button>
            </form>
            <form action={adminTelephoneBookingCloseAction}>
              <input type="hidden" name="saleId" value={saleId} />
              <input type="hidden" name="bookingId" value={row.id} />
              <Button type="submit" size="sm" variant="secondary">
                Close line
              </Button>
            </form>
            <form
              action={adminTelephoneBookingCancelAction}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="saleId" value={saleId} />
              <input type="hidden" name="bookingId" value={row.id} />
              <Input
                name="reason"
                placeholder="Cancellation reason"
                className="h-9 w-52 font-body text-sm"
              />
              <Button type="submit" size="sm" variant="outline">
                Cancel
              </Button>
            </form>
          </>
        ) : null}
      </div>

      <form action={adminTelephoneBookingNotesAction} className="space-y-2">
        <input type="hidden" name="saleId" value={saleId} />
        <input type="hidden" name="bookingId" value={row.id} />
        <Label htmlFor={`notes-${row.id}`} className="text-xs">
          Staff notes
        </Label>
        <Textarea
          id={`notes-${row.id}`}
          name="notes"
          defaultValue={row.notes ?? ""}
          rows={2}
          className="font-body text-sm"
        />
        <Button type="submit" size="sm" variant="secondary">
          Save notes
        </Button>
      </form>
    </div>
  );
}
