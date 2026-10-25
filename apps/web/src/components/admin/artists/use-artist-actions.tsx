"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminReviewArtistResultAction } from "@/lib/actions/admin";
import type { ArtistsStaffRow } from "@/lib/admin/artists/artists-staff-list.vm";
import type { OverflowAction } from "@auction/staff-ui";
import { useCallback } from "react";

/**
 * An artist's review decision from a list row or the record panel: approve or reject a pending
 * profile. Both ask first through the kit confirm; rejecting takes the reason, which is kept with
 * the profile. Roles without review access get neither.
 */
export function useArtistActions({ canReview }: { canReview: boolean }) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;

  const approve = useCallback(
    (artist: ArtistsStaffRow) =>
      ask({
        title: `Approve ${artist.name}?`,
        description:
          "The profile becomes the canonical artist: lots can be attributed to it and it can appear on the site.",
        confirmLabel: "Approve artist",
        run: () => adminReviewArtistResultAction(artist.id, { decision: "approved" }),
        success: `${artist.name} approved`,
      }),
    [ask],
  );

  const reject = useCallback(
    (artist: ArtistsStaffRow) =>
      ask({
        title: `Reject ${artist.name}?`,
        description:
          "The profile stays in the registry as rejected and cannot be attributed to lots.",
        confirmLabel: "Reject artist",
        tone: "danger",
        reason: {
          label: "Reason for rejecting",
          description: "Kept with the profile.",
          maxLength: 1000,
        },
        run: ({ reason }) =>
          adminReviewArtistResultAction(artist.id, {
            decision: "rejected",
            rejectionReason: reason,
          }),
        success: `${artist.name} rejected`,
      }),
    [ask],
  );

  const actionsFor = useCallback(
    (artist: ArtistsStaffRow): OverflowAction[] => {
      if (!canReview || artist.statusCode !== "pending") return [];
      return [
        { id: "approve", label: "Approve artist", onSelect: () => approve(artist) },
        { id: "reject", label: "Reject artist…", tone: "danger", onSelect: () => reject(artist) },
      ];
    },
    [canReview, approve, reject],
  );

  return { actionsFor, dialogs: confirm.dialog };
}
