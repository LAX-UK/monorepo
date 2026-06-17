"use client";

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
import { Button } from "@auction/ui/components/button";

type Props = {
  saleId: string;
  currentLotId: string | null;
  rows: AdminTelephoneBookingRow[];
};

export function TelephoneLinesPanel({ saleId, currentLotId, rows }: Props) {
  const active = rows.filter(
    (r) => r.status === "confirmed" || r.status === "in_progress" || r.status === "requested",
  );

  return (
    <ConsolePanel>
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
                  <form action={adminTelephoneBookingStartLineAction}>
                    <input type="hidden" name="saleId" value={saleId} />
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="lotId" value={currentLotId} />
                    <Button type="submit" size="sm" variant="secondary">
                      Start line
                    </Button>
                  </form>
                  <form action={adminTelephoneBookingCompleteLineAction}>
                    <input type="hidden" name="saleId" value={saleId} />
                    <input type="hidden" name="bookingId" value={row.id} />
                    <input type="hidden" name="lotId" value={currentLotId} />
                    <Button type="submit" size="sm" variant="outline">
                      Complete line
                    </Button>
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
