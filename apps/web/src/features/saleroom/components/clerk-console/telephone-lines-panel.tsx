"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import {
  adminTelephoneBookingCompleteLineAction,
  adminTelephoneBookingStartLineAction,
} from "@/lib/actions/admin";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import { formatMoney } from "@/lib/ui/format";
import { Badge } from "@auction/ui/components/badge";

type Props = {
  saleId: string;
  currentLotId: string | null;
  rows: AdminTelephoneBookingRow[];
  panelVariant?: "bordered" | "plain";
};

export function TelephoneLinesPanel({
  saleId,
  currentLotId,
  rows,
  panelVariant = "bordered",
}: Props) {
  const active = rows.filter(
    (r) => r.status === "confirmed" || r.status === "in_progress" || r.status === "requested",
  );

  return (
    <ConsolePanel variant={panelVariant}>
      <PanelHeading>Telephone lines</PanelHeading>
      {active.length === 0 ? (
        <p className="mt-2 font-body text-sm text-secondary">No active telephone bookings.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {active.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-outline-variant/20 bg-surface-container-low/30 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium text-foreground">
                    {row.userName ?? row.userEmail ?? row.userId}
                  </p>
                  <p className="font-body text-xs text-secondary">
                    {row.phoneDisplay ?? row.phoneE164}
                  </p>
                  {row.authorizedMax ? (
                    <p className="font-body text-xs text-secondary">
                      Max {formatMoney(row.authorizedMax)}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">{telephoneBookingStatusLabel(row.status)}</Badge>
              </div>
              {currentLotId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form id={`tel-start-${row.id}`} action={adminTelephoneBookingStartLineAction}>
                    <input type="hidden" name="saleId" value={saleId} />
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="lotId" value={currentLotId} />
                    <SaleroomPendingSubmit
                      formId={`tel-start-${row.id}`}
                      pendingLabel="Starting…"
                      variant="secondary"
                      className="min-h-11"
                    >
                      Start line
                    </SaleroomPendingSubmit>
                  </form>
                  <form
                    id={`tel-complete-${row.id}`}
                    action={adminTelephoneBookingCompleteLineAction}
                  >
                    <input type="hidden" name="saleId" value={saleId} />
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="lotId" value={currentLotId} />
                    <SaleroomPendingSubmit
                      formId={`tel-complete-${row.id}`}
                      pendingLabel="Completing…"
                      variant="outline"
                      className="min-h-11"
                    >
                      Complete line
                    </SaleroomPendingSubmit>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ConsolePanel>
  );
}
