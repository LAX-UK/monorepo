"use client";

import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import type { OnsiteEventSegmentOption } from "@auction/types";
import { useMemo, useState } from "react";
import { guestDisplayName, segmentLabel } from "./guest-helpers";

export function useExpectedGuestsSearch(
  items: AdminExpectedGuestRow[],
  segmentOptions: OnsiteEventSegmentOption[],
) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((guest) => {
      const fields = [
        guest.name,
        guest.email,
        guest.attendanceSegment,
        segmentLabel(segmentOptions, guest.attendanceSegment),
      ];
      return fields.some((f) => f?.toLowerCase().includes(needle));
    });
  }, [items, search, segmentOptions]);

  const stats = useMemo(
    () => ({
      galaCheckedIn: items.filter((g) => g.galaCheckedInAt != null).length,
      salePresent: items.filter((g) => g.saleRegistration?.checkedInAt != null).length,
      paddled: items.filter((g) => g.saleRegistration?.paddleNumber != null).length,
    }),
    [items],
  );

  return { search, setSearch, filtered, stats };
}

export function useGuestCheckInEntity(guest: AdminExpectedGuestRow) {
  const [entityId, setEntityId] = useState(() => {
    const personal = guest.eligibleEntities.find((e) => e.kind === "individual");
    return personal?.id ?? guest.eligibleEntities[0]?.id ?? "";
  });
  return { entityId, setEntityId };
}

export { guestDisplayName };
