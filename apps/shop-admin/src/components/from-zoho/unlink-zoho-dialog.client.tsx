"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { unlinkFromZoho } from "@/server/application/admin-zoho-link-actions.server";
import { ConfirmActionDialog, Notice, toast } from "@auction/staff-ui";
import { useState } from "react";

/**
 * Removing the link between a lax.art original and its Zoho record. Administrators only, and the
 * reason is required: it is kept in the register's history with who removed the link. It is
 * refused while the artwork is in a Bid sale, and the refusal is shown here in the register's words.
 */
export function UnlinkZohoDialog({
  open,
  onOpenChange,
  artworkId,
  artworkTitle,
  onUnlinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  artworkTitle: string;
  onUnlinked: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm({ reason }: { reason: string }) {
    setSaving(true);
    setError(null);
    const result = await unlinkFromZoho({ artworkId, reason }).catch(() => null);
    setSaving(false);
    if (result?.ok) {
      toast.success("Link removed");
      onOpenChange(false);
      onUnlinked();
      return;
    }
    setError(
      result
        ? adminMutationErrorMessage(result)
        : "Could not remove the link. Try again in a moment.",
    );
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          if (!next) setError(null);
          onOpenChange(next);
        }
      }}
      title="Remove the link to Zoho"
      description={`${artworkTitle} will no longer be tied to its Zoho record. The one-place lock and moves stop protecting it until it is linked again.`}
      confirmLabel="Remove link"
      tone="danger"
      loading={saving}
      reason={{
        label: "Why is the link being removed?",
        description: "Kept in the register's history with your name.",
        maxLength: 500,
        missingMessage: "Say why the link is being removed.",
      }}
      onConfirm={(details) => void confirm(details)}
    >
      {error ? (
        <Notice tone="danger" alert title="The link was not removed">
          {error}
        </Notice>
      ) : null}
    </ConfirmActionDialog>
  );
}
