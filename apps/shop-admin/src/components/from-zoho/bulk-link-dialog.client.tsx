"use client";

import { LinkChangesTable } from "@/components/from-zoho/link-changes";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { linkManyToZoho } from "@/server/application/admin-zoho-link-actions.server";
import { bulkSummary, outcomeSentence, planBulkLink } from "@/server/domain/zoho-link.vm";
import {
  ADMIN_ZOHO_LINK_BULK_MAX,
  type AdminZohoLinkOutcome,
  type AdminZohoLinkRow,
} from "@auction/shop-contracts";
import { Notice, StaffButton, StaffDialog, toast } from "@auction/staff-ui";
import { ChevronDown, ChevronRight, Globe, Link2, Pencil } from "@auction/staff-ui/icons";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function SummaryRow({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-staff-md bg-staff-sunken px-3 py-2.5">
      <span aria-hidden className="mt-0.5 text-staff-muted [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-staff-sm font-medium text-staff-fg">{title}</span>
        <span className="text-staff-xs text-staff-muted">{children}</span>
      </span>
    </li>
  );
}

export type BulkLinkViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matched: readonly AdminZohoLinkRow[];
  saving: boolean;
  error: string | null;
  /** Set once linking has run: what happened to each artwork. */
  outcomes: readonly AdminZohoLinkOutcome[] | null;
  onConfirm: () => void;
};

/**
 * Confirming Matched rows together. It says in three lines what will happen (how many are linked,
 * whose details Zoho replaces, which listings become On lax.art), offers the before and after of
 * each listing that changes, and afterwards reports what happened to each. Only Matched rows are
 * ever linked from here.
 */
export function BulkLinkView({
  open,
  onOpenChange,
  matched,
  saving,
  error,
  outcomes,
  onConfirm,
}: BulkLinkViewProps) {
  const [showChanges, setShowChanges] = useState(false);
  const plan = useMemo(() => planBulkLink(matched), [matched]);
  const summary = useMemo(() => bulkSummary(plan), [plan]);
  const count = plan.links.length;
  const problems = outcomes?.filter(
    (outcome) => outcome.status === "refused" || outcome.status === "not_a_match",
  );
  const titleOf = (artworkId: string) =>
    matched.find((row) => row.listing.artworkId === artworkId)?.listing.title ?? "Artwork";

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      size="md"
      title={
        outcomes
          ? "Linking finished"
          : `Link ${plural(count, "lax.art listing", "lax.art listings")} to Zoho?`
      }
      description={
        outcomes
          ? outcomeSentence(outcomes)
          : "Each listing is linked to the Zoho record shown in the report."
      }
      footer={
        outcomes ? (
          <StaffButton variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </StaffButton>
        ) : (
          <>
            <StaffButton variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </StaffButton>
            <StaffButton
              variant="primary"
              loading={saving}
              disabled={count === 0}
              onClick={onConfirm}
            >
              {error ? "Try again" : `Link ${plural(count, "listing", "listings")}`}
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
            <Notice tone="success" title="Every listing was linked" />
          )
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              <SummaryRow
                icon={<Link2 />}
                title={`${plural(summary.linked, "listing", "listings")} linked`}
              >
                Each one now follows the one-place lock and is shown in Zoho as offered.
              </SummaryRow>
              {summary.changed.length > 0 ? (
                <SummaryRow
                  icon={<Pencil />}
                  title={`Zoho's details replace lax.art's on ${plural(summary.changed.length, "listing", "listings")}`}
                >
                  {summary.changed
                    .map((item) => `${item.row.listing.title}: ${item.fields}.`)
                    .join(" ")}{" "}
                  Web addresses stay the same.
                </SummaryRow>
              ) : (
                <SummaryRow icon={<Pencil />} title="lax.art and Zoho already agree">
                  Nothing changes except the link. Web addresses stay the same.
                </SummaryRow>
              )}
              {summary.live > 0 ? (
                <SummaryRow
                  icon={<Globe />}
                  title={`${plural(summary.live, "live listing becomes", "live listings become")} On lax.art in the register`}
                >
                  {summary.drafts > 0
                    ? `${summary.drafts === 1 ? "The draft stays a draft." : "The drafts stay drafts."}`
                    : "Each is already live, so nothing changes for buyers."}
                </SummaryRow>
              ) : null}
            </ul>
            {summary.changed.length > 0 ? (
              <div className="rounded-staff-md border border-staff-line">
                <StaffButton
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  aria-expanded={showChanges}
                  icon={showChanges ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                  onClick={() => setShowChanges((open) => !open)}
                >
                  See what changes on each listing
                </StaffButton>
                {showChanges ? (
                  <div className="flex flex-col gap-4 border-t border-staff-line-subtle p-3">
                    {summary.changed.map((item) => (
                      <section
                        key={item.row.listing.artworkId}
                        aria-label={item.row.listing.title}
                        className="flex flex-col gap-2"
                      >
                        <h3 className="text-staff-sm font-medium text-staff-fg">
                          {item.row.listing.title}
                          <span className="ml-2 text-staff-xs font-normal text-staff-muted tabular-nums">
                            {item.candidate.record.stockCode}
                          </span>
                        </h3>
                        <LinkChangesTable
                          comparison={item.candidate.comparison}
                          label={`What linking changes on ${item.row.listing.title}`}
                        />
                      </section>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </StaffDialog>
  );
}

/**
 * Links the Matched rows when staff confirm. The server takes 200 at a time, so a long list goes
 * in parts; what was linked before a failure is still reported.
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<AdminZohoLinkOutcome[] | null>(null);

  function close(next: boolean) {
    if (next || saving) return;
    onOpenChange(false);
    if (outcomes) onDone();
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const { links } = planBulkLink(matched);
    const done: AdminZohoLinkOutcome[] = [];
    let failure: string | null = null;
    for (let start = 0; start < links.length; start += ADMIN_ZOHO_LINK_BULK_MAX) {
      const result = await linkManyToZoho(
        links.slice(start, start + ADMIN_ZOHO_LINK_BULK_MAX),
      ).catch(() => null);
      if (!result?.ok) {
        failure = result
          ? adminMutationErrorMessage(result)
          : "Could not link the artworks. Check again to see what was linked.";
        break;
      }
      done.push(...result.data.outcomes);
    }
    setSaving(false);
    if (done.length > 0) {
      setOutcomes(done);
      toast.success(outcomeSentence(done));
    }
    setError(failure);
  }

  return (
    <BulkLinkView
      open={open}
      onOpenChange={close}
      matched={matched}
      saving={saving}
      error={error}
      outcomes={outcomes}
      onConfirm={() => void submit()}
    />
  );
}
