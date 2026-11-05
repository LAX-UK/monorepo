"use client";

import { LinkDifferences } from "@/components/from-zoho/link-differences";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { linkToZoho } from "@/server/application/admin-zoho-link-actions.server";
import { LINK_RULE_LABEL } from "@/server/domain/zoho-link.vm";
import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkListing,
  AdminZohoLinkRow,
} from "@auction/shop-contracts";
import { Notice, StaffButton, StaffDialog, StatusBadge, toast } from "@auction/staff-ui";
import { useState } from "react";

export type LinkConfirmViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: AdminZohoLinkListing;
  candidate: AdminZohoLinkCandidate;
  rule?: AdminZohoLinkRow["rule"];
  saving: boolean;
  /** Why the last attempt was refused or failed, in the register's words. */
  error: string | null;
  onConfirm: () => void;
};

/**
 * Before one artwork is linked: the lax.art artwork beside the Zoho record, what Zoho's details
 * will change on lax.art, and where the artwork goes. Nothing happens until staff confirm.
 */
export function LinkConfirmView({
  open,
  onOpenChange,
  listing,
  candidate,
  rule,
  saving,
  error,
  onConfirm,
}: LinkConfirmViewProps) {
  const blocked = candidate.refusal !== null;
  const { record } = candidate;
  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      size="md"
      title="Link to Zoho record"
      description="Linking puts this artwork under the register's one-place lock. Zoho becomes the source of its details."
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            {blocked ? "Close" : "Cancel"}
          </StaffButton>
          {blocked ? null : (
            <StaffButton variant="primary" loading={saving} onClick={onConfirm}>
              {error ? "Try again" : "Link artwork"}
            </StaffButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Notice tone="danger" alert title="Not linked">
            {error}
          </Notice>
        ) : null}
        {candidate.refusal ? (
          <Notice tone="warning" title="This artwork can't be linked to that record now">
            {candidate.refusal}
          </Notice>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <section
            aria-label="On lax.art"
            className="rounded-staff-md border border-staff-line p-3"
          >
            <p className="text-staff-xs font-medium text-staff-muted">On lax.art</p>
            <h3 className="text-staff-md font-semibold text-staff-fg">{listing.title}</h3>
            <p className="text-staff-xs text-staff-muted">
              {listing.artistName} · lax.art/artworks/{listing.slug}
            </p>
            <StatusBadge tone={listing.published ? "success" : "neutral"} className="mt-2">
              {listing.published ? "Live" : "Draft"}
            </StatusBadge>
          </section>
          <section aria-label="In Zoho" className="rounded-staff-md border border-staff-line p-3">
            <p className="text-staff-xs font-medium text-staff-muted">In Zoho</p>
            <h3 className="text-staff-md font-semibold text-staff-fg">{record.title}</h3>
            <p className="text-staff-xs text-staff-muted">
              {record.artistName} · <span className="tabular-nums">{record.stockCode}</span>
            </p>
            <StatusBadge
              tone={record.whereItIs === "Not offered" ? "neutral" : "info"}
              className="mt-2"
            >
              {record.whereItIs}
            </StatusBadge>
          </section>
        </div>
        {rule ? (
          <p className="text-staff-xs text-staff-muted">Matched by: {LINK_RULE_LABEL[rule]}.</p>
        ) : null}
        <LinkDifferences differences={candidate.differences} />
        {blocked ? null : (
          <p className="text-staff-sm text-staff-muted">
            {listing.published && record.whereItIs === "Not offered"
              ? "This artwork is live, so the register will show it as On lax.art."
              : listing.published
                ? "This artwork is live on lax.art."
                : "This artwork is a draft. The register will show it as On lax.art when it is published."}
          </p>
        )}
      </div>
    </StaffDialog>
  );
}

/** Links one artwork to one record when staff confirm. A refusal is shown with the register's words. */
export function LinkConfirmDialog({
  open,
  onOpenChange,
  listing,
  candidate,
  rule,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: AdminZohoLinkListing;
  candidate: AdminZohoLinkCandidate;
  rule?: AdminZohoLinkRow["rule"];
  onLinked: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    const result = await linkToZoho({
      artworkId: listing.artworkId,
      registerId: candidate.record.registerId,
    }).catch(() => null);
    setSaving(false);
    if (result?.ok) {
      toast.success(
        result.data.status === "already_linked"
          ? "Already linked to this record"
          : "Linked to the Zoho record",
      );
      onOpenChange(false);
      onLinked();
      return;
    }
    setError(
      result
        ? adminMutationErrorMessage(result)
        : "Could not link the artwork. Try again in a moment.",
    );
  }

  return (
    <LinkConfirmView
      open={open}
      onOpenChange={onOpenChange}
      listing={listing}
      candidate={candidate}
      {...(rule !== undefined ? { rule } : {})}
      saving={saving}
      error={error}
      onConfirm={() => void confirm()}
    />
  );
}
