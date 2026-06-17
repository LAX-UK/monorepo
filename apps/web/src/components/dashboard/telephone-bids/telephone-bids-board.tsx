"use client";

import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { PLATFORM_DEFAULT_CURRENCY } from "@/lib/money/currency";
import type { TelephoneBookingListItem } from "@/lib/telephone/telephone-booking-types";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { Badge } from "@auction/ui/components/badge";
import Link from "next/link";

type Props = {
  rows: TelephoneBookingListItem[];
};

export function TelephoneBidsBoard({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <DashboardEmptyState
        title="No telephone bookings"
        description="When you request a live telephone line for an onsite sale, it will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border-hairline rounded-xl border border-border-hairline bg-surface-container-lowest">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/dashboard/telephone-bids/${row.id}`}
            className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-on-surface truncate">
                {row.saleTitle ?? "Onsite sale"}
              </p>
              <p className="font-body text-xs text-on-surface-variant">
                Requested {formatDateTime(row.createdAt)}
                {row.lotIds.length > 0 ? ` · ${row.lotIds.length} lot(s)` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {row.authorizedMax ? (
                <span className="font-body text-xs tabular-nums text-on-surface-variant">
                  Max {formatMoney(row.authorizedMax, PLATFORM_DEFAULT_CURRENCY)}
                </span>
              ) : null}
              <Badge variant="secondary">{telephoneBookingStatusLabel(row.status)}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
