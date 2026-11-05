"use client";

import { LinkDifferences } from "@/components/from-zoho/link-differences";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { linkManyToZoho } from "@/server/application/admin-zoho-link-actions.server";
import { outcomeSentence, planBulkLink } from "@/server/domain/zoho-link.vm";
import type { AdminZohoLinkOutcome, AdminZohoLinkRow } from "@auction/shop-contracts";
import { Notice, StaffButton, StaffDialog, toast } from "@auction/staff-ui";
import { useMemo, useState } from "react";

/**
 * Confirming every Matched row at once. It lists what will change on each artwork (rows that
 * differ first, highlighted, with lax.art's old value struck through), sets aside rows the
 * register refuses and says why, and afterwards reports what happened to each. Only Matched rows
 * are ever linked from here.
 */
export function BulkLinkDialog({
  open,
  onOpenChange,
  matched,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matched: readonly AdminZohoLinkRow[];
  /** Called when the dialog closes after linking, so the report is read again. */
  onDone: () => void;
}) {
  const plan = useMemo(() => planBulkLink(matched), [matched]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<AdminZohoLinkOutcome[] | null>(null);

  const sorted = useMemo(
    () =>
      [...plan.linkable].sort(
        (a, b) => b.candidate.differences.length - a.candidate.differences.length,
      ),
    [plan.linkable],
  );

  function close() {
    if (saving) return;
    onOpenChange(false);
    if (outcomes) onDone();
    setOutcomes(null);
    setError(null);
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    const result = await linkManyToZoho(plan.links).catch(() => null);
    setSaving(false);
    if (result?.ok) {
      setOutcomes(result.data.outcomes);
      toast.success(outcomeSentence(result.data.outcomes));
      return;
    }
    setError(
      result
        ? adminMutationErrorMessage(result)
        : "Could not link the artworks. Nothing was changed that you can't check again.",
    );
  }

  const problems = outcomes?.filter(
    (outcome) => outcome.status === "refused" || outcome.status === "not_a_match",
  );
  const titleOf = (artworkId: string) =>
    matched.find((row) => row.listing.artworkId === artworkId)?.listing.title ?? "Artwork";

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      size="lg"
      title={outcomes ? "Linking finished" : `Link ${plan.links.length} matched artworks`}
      description={
        outcomes
          ? outcomeSentence(outcomes)
          : "Only Matched rows are linked here. Where lax.art and Zoho disagree, Zoho's value replaces lax.art's. Web addresses are kept."
      }
      footer={
        outcomes ? (
          <StaffButton variant="primary" onClick={close}>
            Done
          </StaffButton>
        ) : (
          <>
            <StaffButton variant="secondary" disabled={saving} onClick={close}>
              Cancel
            </StaffButton>
            <StaffButton
              variant="primary"
              loading={saving}
              disabled={plan.links.length === 0}
              onClick={() => void confirm()}
            >
              {error ? "Try again" : `Link ${plan.links.length} artworks`}
            </StaffButton>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Notice tone="danger" alert title="Not linked">
            {error}
          </Notice>
        ) : null}
        {outcomes ? (
          problems && problems.length > 0 ? (
            <Notice tone="warning" title="These were not linked">
              <ul className="list-disc pl-5">
                {problems.map((outcome) => (
                  <li key={outcome.artworkId}>
                    {titleOf(outcome.artworkId)}: {outcome.message}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            <Notice tone="success" title="Every artwork was linked" />
          )
        ) : (
          <>
            <p className="text-staff-sm text-staff-fg">
              {plan.withDifferences === 0
                ? "lax.art and Zoho already agree on every one of these."
                : `${plan.withDifferences} of ${plan.links.length} differ from Zoho, shown first.`}
            </p>
            {plan.refused.length > 0 ? (
              <Notice
                tone="warning"
                title={`${plan.refused.length} matched ${plan.refused.length === 1 ? "artwork" : "artworks"} will be left out`}
              >
                <ul className="list-disc pl-5">
                  {plan.refused.map((item) => (
                    <li key={item.row.listing.artworkId}>
                      {item.row.listing.title}: {item.candidate.refusal}
                    </li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            <ul className="flex flex-col gap-3">
              {sorted.map(({ row, candidate }) => (
                <li
                  key={row.listing.artworkId}
                  className="rounded-staff-md border border-staff-line p-3"
                >
                  <p className="text-staff-sm font-medium text-staff-fg">{row.listing.title}</p>
                  <p className="mb-2 text-staff-xs text-staff-muted">
                    {row.listing.artistName} ·{" "}
                    <span className="tabular-nums">{candidate.record.stockCode}</span>
                  </p>
                  {candidate.differences.length > 0 ? (
                    <LinkDifferences differences={candidate.differences} />
                  ) : (
                    <p className="text-staff-xs text-staff-muted">No differences.</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </StaffDialog>
  );
}
