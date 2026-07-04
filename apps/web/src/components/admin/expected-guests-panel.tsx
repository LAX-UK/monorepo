"use client";

import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import type { OnsiteEventSegmentOption, SaleDeliveryMode } from "@auction/types";
import { Input } from "@auction/ui/components/input";
import Link from "next/link";
import { ExpectedGuestRow } from "./expected-guests/expected-guest-row";
import { useExpectedGuestsSearch } from "./expected-guests/use-expected-guests";

type Props = {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  eventSlug: string;
  eventTitle: string;
  segmentOptions: OnsiteEventSegmentOption[];
  items: AdminExpectedGuestRow[];
};

export function ExpectedGuestsPanel({
  saleId,
  deliveryMode,
  eventSlug,
  eventTitle,
  segmentOptions,
  items,
}: Props) {
  const { search, setSearch, filtered, stats } = useExpectedGuestsSearch(items, segmentOptions);

  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-headline text-base font-semibold text-on-surface">Expected guests</h3>
          <p className="font-body text-sm text-on-surface-variant">
            RSVP guests from{" "}
            <Link
              href={`/admin/event-rsvps/${encodeURIComponent(eventSlug)}`}
              className="text-link underline"
            >
              {eventTitle}
            </Link>
            .{" "}
            {deliveryMode === "hybrid"
              ? "Hybrid sales default to marking present; assign a paddle only when the guest wants to bid in the room."
              : "Assign paddles for in-room bidding."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 font-body text-xs text-on-surface-variant">
          <span>
            RSVP&apos;d <strong className="tabular-nums text-on-surface">{items.length}</strong>
          </span>
          <span>
            Gala in <strong className="tabular-nums text-on-surface">{stats.galaCheckedIn}</strong>
          </span>
          <span>
            Present <strong className="tabular-nums text-on-surface">{stats.salePresent}</strong>
          </span>
          <span>
            Paddled <strong className="tabular-nums text-on-surface">{stats.paddled}</strong>
          </span>
        </div>
      </div>

      <div className="mt-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expected guests…"
          className="max-w-sm font-body text-sm"
          aria-label="Search expected guests"
        />
      </div>

      <ul className="mt-4 divide-y divide-border-hairline rounded-md border border-border-hairline">
        {filtered.map((guest) => (
          <ExpectedGuestRow
            key={guest.rsvpId}
            saleId={saleId}
            deliveryMode={deliveryMode}
            guest={guest}
            segmentOptions={segmentOptions}
          />
        ))}
        {filtered.length === 0 ? (
          <li className="px-4 py-6 font-body text-sm text-on-surface-variant">
            No matching expected guests.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
