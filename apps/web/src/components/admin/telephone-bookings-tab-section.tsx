import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  adminTelephoneBookingApproveLimitIncreaseAction,
  adminTelephoneBookingAssignClerkAction,
  adminTelephoneBookingCancelAction,
  adminTelephoneBookingCloseAction,
  adminTelephoneBookingConfirmAction,
  adminTelephoneBookingNotesAction,
} from "@/lib/actions/admin";
import { saleStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import type { SaleStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";

function BookingRow({ saleId, row }: { saleId: string; row: AdminTelephoneBookingRow }) {
  const pendingConfirm = row.status === "requested";
  const pendingLimit = row.limitIncreaseRequestedAt != null;

  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-4 space-y-4">
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
            <a href={`tel:${row.phoneE164}`} className="underline underline-offset-2">
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
          <p className="font-body text-xs text-on-surface-variant">
            Requested: {formatDateTime(row.createdAt)}
          </p>
        </div>
        <Badge variant="secondary">{telephoneBookingStatusLabel(row.status)}</Badge>
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

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  liveish: boolean;
  rows: AdminTelephoneBookingRow[];
  fetchError?: string | null;
  actionError?: string | null;
};

export function TelephoneBookingsTabSection({
  saleId,
  saleStatus,
  liveish,
  rows,
  fetchError = null,
  actionError = null,
}: Props) {
  if (!liveish) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        Telephone bookings open when the sale is scheduled or live. Current status:{" "}
        <strong>{saleStatusLabel[saleStatus]}</strong>.
      </p>
    );
  }

  const active = rows.filter((r) => r.status !== "cancelled" && r.status !== "completed");
  const archived = rows.filter((r) => r.status === "cancelled" || r.status === "completed");

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-on-surface-variant">
        {rows.length} booking{rows.length === 1 ? "" : "s"} · {active.length} active
      </p>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load bookings</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {!fetchError && rows.length === 0 ? (
        <AdminEmptyState
          title="No telephone bookings"
          description="Buyer telephone line requests will appear here."
        />
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Active
          </h3>
          {active.map((row) => (
            <BookingRow key={row.id} saleId={saleId} row={row} />
          ))}
        </div>
      ) : null}

      {archived.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Completed / cancelled
          </h3>
          {archived.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-border-hairline/60 bg-surface-container-low/20 p-4"
            >
              <p className="font-medium">{row.userName ?? row.userEmail ?? row.userId}</p>
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                {telephoneBookingStatusLabel(row.status)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
