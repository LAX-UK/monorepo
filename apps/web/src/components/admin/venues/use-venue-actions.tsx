"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminArchiveVenueResultAction } from "@/lib/actions/admin-venues";
import type { OverflowAction } from "@auction/staff-ui";
import { useCallback } from "react";

/** What the venue actions need to know about a venue, from a list row. */
export type VenueActionTarget = {
  id: string;
  name: string;
  archived: boolean;
};

/**
 * A venue's state-changing action from a list row's `…` menu or its panel: archive, asked first
 * through the kit confirm. An archived venue has nothing left to offer, so the menu leaves it out.
 */
export function useVenueActions() {
  const confirm = useStaffConfirm();
  const { ask } = confirm;

  const archive = useCallback(
    (venue: VenueActionTarget) =>
      ask({
        title: `Archive ${venue.name}?`,
        description:
          "Sales already held there keep the venue, but it can no longer be chosen for new onsite sales.",
        confirmLabel: "Archive venue",
        run: () => adminArchiveVenueResultAction(venue.id),
        success: `${venue.name} archived`,
      }),
    [ask],
  );

  const actionsFor = useCallback(
    (venue: VenueActionTarget): OverflowAction[] =>
      venue.archived
        ? []
        : [{ id: "archive", label: "Archive venue…", onSelect: () => archive(venue) }],
    [archive],
  );

  return { actionsFor, archive, dialogs: confirm.dialog };
}
