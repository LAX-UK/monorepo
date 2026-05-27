import {
  adminLotFulfilmentCollectedAction,
  adminLotFulfilmentDeliveredAction,
  adminLotFulfilmentReadyForCollectionAction,
  adminLotFulfilmentReleaseAction,
  adminLotFulfilmentShipAction,
} from "@/lib/actions/admin";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { Textarea } from "@auction/ui/components/textarea";
import Link from "next/link";

const inputClass =
  "w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

type Props = {
  row: AdminLotFulfilmentListRow;
  /** Current list filter; echoed back on redirect after actions. */
  returnStatus: string;
  /** When true, renders a div panel (e.g. sheet drawer) instead of a list item. */
  embedded?: boolean;
};

export function AdminLotFulfilmentQueueCard({ row, returnStatus, embedded = false }: Props) {
  const hiddenReturn =
    returnStatus.trim() !== "" ? (
      <input type="hidden" name="returnStatus" value={returnStatus} />
    ) : null;

  const Wrapper = embedded ? "div" : "li";
  return (
    <Wrapper className="rounded-lg border border-outline-variant/30 p-4">
      <div className="font-body text-sm">
        <p className="font-medium">
          <Link href={`/admin/lots/${row.lotId}`} className="text-primary hover:underline">
            {row.lotTitle ?? row.lotId}
          </Link>
        </p>
        <p className="mt-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          {statusLabel(row.status)}
          {row.fulfilmentMethod ? ` · ${row.fulfilmentMethod}` : ""}
        </p>
        {row.shippingCarrier || row.trackingNumber ? (
          <p className="mt-1 text-xs text-on-surface-variant">
            {[row.shippingCarrier, row.trackingNumber].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {row.status === "awaiting_release" ? (
        <form
          action={adminLotFulfilmentReleaseAction}
          className="mt-4 space-y-2 border-t border-border-hairline pt-4"
        >
          <input type="hidden" name="lotId" value={row.lotId} />
          {hiddenReturn}
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Approve release
          </p>
          <Textarea name="notes" placeholder="Notes (optional)" className="min-h-16 text-xs" />
          <Button type="submit" size="sm" className="min-h-9">
            Release to buyer logistics
          </Button>
        </form>
      ) : null}

      {row.status === "released" ? (
        <div className="mt-4 space-y-4 border-t border-border-hairline pt-4">
          <form action={adminLotFulfilmentShipAction} className="space-y-2">
            <input type="hidden" name="lotId" value={row.lotId} />
            {hiddenReturn}
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Ship
            </p>
            <input name="carrier" placeholder="Carrier" className={inputClass} required />
            <input
              name="trackingNumber"
              placeholder="Tracking number"
              className={inputClass}
              required
            />
            <Button type="submit" size="sm" className="min-h-9">
              Mark in transit
            </Button>
          </form>
          <form action={adminLotFulfilmentReadyForCollectionAction}>
            <input type="hidden" name="lotId" value={row.lotId} />
            {hiddenReturn}
            <Button type="submit" size="sm" variant="outline" className="min-h-9">
              Ready for collection
            </Button>
          </form>
        </div>
      ) : null}

      {row.status === "in_transit" ? (
        <form
          action={adminLotFulfilmentDeliveredAction}
          className="mt-4 border-t border-border-hairline pt-4"
        >
          <input type="hidden" name="lotId" value={row.lotId} />
          {hiddenReturn}
          <Button type="submit" size="sm" className="min-h-9">
            Mark delivered
          </Button>
        </form>
      ) : null}

      {row.status === "ready_for_collection" ? (
        <form
          action={adminLotFulfilmentCollectedAction}
          className="mt-4 space-y-2 border-t border-border-hairline pt-4"
        >
          <input type="hidden" name="lotId" value={row.lotId} />
          {hiddenReturn}
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Collection
          </p>
          <input
            name="collectedBy"
            placeholder="Collected by (name)"
            className={inputClass}
            required
          />
          <Button type="submit" size="sm" className="min-h-9">
            Mark collected / delivered
          </Button>
        </form>
      ) : null}

      {row.status === "awaiting_payment" ? (
        <p className="mt-4 border-t border-border-hairline pt-4 text-xs text-on-surface-variant">
          Waiting for the winning bidder to complete payment. No release actions yet.
        </p>
      ) : null}

      {row.status === "delivered" || row.status === "cancelled" ? (
        <p className="mt-4 border-t border-border-hairline pt-4 text-xs text-on-surface-variant">
          {row.status === "delivered"
            ? "This lot is closed out for fulfilment."
            : "This fulfilment was cancelled."}
        </p>
      ) : null}
    </Wrapper>
  );
}
