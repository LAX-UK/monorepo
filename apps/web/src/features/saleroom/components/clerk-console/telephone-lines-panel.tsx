"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { clerkTelephoneLine } from "@/features/saleroom/lib/clerk-commands.client";
import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";
import { staffTelephoneBookingStatus } from "@/lib/admin/staff-kit-status";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { StatusBadge } from "@auction/staff-ui";

type Props = {
  saleId: string;
  currentLotId: string | null;
  rows: AdminTelephoneBookingRow[];
  panelVariant?: "bordered" | "plain";
};

/** The telephone bidders for this sale: who is waiting, and starting and finishing their line. */
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
        <p className="mt-2 text-staff-sm text-staff-muted">No active telephone bookings.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {active.map((row) => {
            const status = staffTelephoneBookingStatus(row.status);
            return (
              <li
                key={row.id}
                className="rounded-staff-sm border border-staff-line-subtle bg-staff-sunken p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-staff-sm font-medium text-staff-fg">
                      {row.userName ?? row.userEmail ?? "Unnamed bidder"}
                    </p>
                    <p className="text-staff-sm text-staff-muted tabular-nums">
                      {row.phoneDisplay ?? row.phoneE164}
                    </p>
                    {row.authorizedMax ? (
                      <p className="text-staff-sm text-staff-muted tabular-nums">
                        Limit {formatSaleroomMoney(row.authorizedMax)}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge tone={status.tone} live={status.live ?? false}>
                    {status.label}
                  </StatusBadge>
                </div>
                {currentLotId ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SaleroomPendingSubmit
                      pendingLabel="Starting…"
                      variant="secondary"
                      size="lg"
                      onRun={() =>
                        clerkTelephoneLine({
                          saleId,
                          bookingId: row.id,
                          lotId: currentLotId,
                          step: "start-line",
                        })
                      }
                    >
                      Start line
                    </SaleroomPendingSubmit>
                    <SaleroomPendingSubmit
                      pendingLabel="Completing…"
                      variant="secondary"
                      size="lg"
                      onRun={() =>
                        clerkTelephoneLine({
                          saleId,
                          bookingId: row.id,
                          lotId: currentLotId,
                          step: "complete-line",
                        })
                      }
                    >
                      Complete line
                    </SaleroomPendingSubmit>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </ConsolePanel>
  );
}
