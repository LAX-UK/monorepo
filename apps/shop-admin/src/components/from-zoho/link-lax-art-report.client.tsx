"use client";

import { BulkLinkDialog } from "@/components/from-zoho/bulk-link-dialog.client";
import { LinkConfirmDialog } from "@/components/from-zoho/link-confirm-dialog.client";
import { LinkToZohoDialog } from "@/components/from-zoho/link-to-zoho-dialog.client";
import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getZohoLinkReport,
  setBlockUnlinkedPublish,
} from "@/server/application/admin-zoho-link-actions.server";
import {
  LINK_RULE_LABEL,
  NO_MATCH_REASON_LABEL,
  groupRows,
  planBulkLink,
} from "@/server/domain/zoho-link.vm";
import type { ZohoQueueQuery } from "@/server/domain/zoho-register.vm";
import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkReport,
  AdminZohoLinkRow,
} from "@auction/shop-contracts";
import {
  EmptyState,
  Notice,
  PageHeader,
  StaffButton,
  StaffSwitch,
  StatGrid,
  StatusBadge,
  formatStaffDateTime,
  toast,
  useStaffAccess,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Review = { row: AdminZohoLinkRow; candidate: AdminZohoLinkCandidate };

function ListingSummary({ row }: { row: AdminZohoLinkRow }) {
  const { listing } = row;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          href={`/artworks/${listing.artworkId}`}
          className="font-medium text-staff-fg underline-offset-2 hover:underline"
        >
          {listing.title}
        </Link>
        <StatusBadge tone={listing.published ? "success" : "neutral"}>
          {listing.published ? "Live" : "Draft"}
        </StatusBadge>
      </p>
      <p className="text-staff-xs text-staff-muted">
        {listing.artistName}
        {listing.dimensions ? ` · ${listing.dimensions}` : ""}
        {listing.year ? ` · ${listing.year}` : ""}
        {listing.stockCode ? ` · ${listing.stockCode}` : ""}
      </p>
    </div>
  );
}

function CandidateLine({ candidate }: { candidate: AdminZohoLinkCandidate }) {
  const { record } = candidate;
  return (
    <div className="min-w-0 text-staff-sm">
      <p className="text-staff-fg">
        {record.title} · <span className="tabular-nums">{record.stockCode}</span>
      </p>
      <p className="text-staff-xs text-staff-muted">
        {record.artistName}
        {record.dimensions ? ` · ${record.dimensions}` : ""}
        {record.year ? ` · ${record.year}` : ""} · {record.whereItIs}
      </p>
      {candidate.refusal ? (
        <p className="mt-1 text-staff-xs text-staff-warning-fg">{candidate.refusal}</p>
      ) : candidate.differences.length > 0 ? (
        <p className="mt-1 text-staff-xs text-staff-warning-fg">
          Differs from Zoho:{" "}
          {candidate.differences.map((difference) => difference.label.toLowerCase()).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

const rowClass =
  "flex flex-col gap-2 border-b border-staff-line-subtle px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between";

/**
 * One-off: every lax.art original that is not linked to a register record, matched to Zoho. Each
 * is Matched, Needs a choice or has No match. Nothing is linked by this page on its own: staff
 * confirm Matched rows together or any row one at a time, after seeing what Zoho's details will
 * change. "Check again" matches again after Zoho is fixed; matching only reads.
 */
export function LinkLaxArtReport({
  query,
  counts,
  report: initial,
}: {
  query: ZohoQueueQuery;
  counts: { new: number; decisions: number };
  report: AdminZohoLinkReport;
}) {
  const router = useRouter();
  const access = useStaffAccess();
  const canLink = access.can("catalogue.write") && access.can("artwork_register.review");
  const canSwitch = access.can("settings.write");
  const [report, setReport] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [finding, setFinding] = useState<AdminZohoLinkRow | null>(null);
  const [bulk, setBulk] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { views } = useQueueFrame(query, counts, report.counts.unlinked);

  useEffect(() => setReport(initial), [initial]);

  async function checkAgain() {
    setChecking(true);
    setCheckError(null);
    const result = await getZohoLinkReport().catch(() => null);
    setChecking(false);
    if (result?.ok) {
      setReport(result.data);
      router.refresh();
      return;
    }
    setCheckError(
      result ? adminMutationErrorMessage(result) : "Could not check again. Try again in a moment.",
    );
  }

  async function toggleSwitch(next: boolean) {
    setSwitching(true);
    const result = await setBlockUnlinkedPublish(next).catch(() => null);
    setSwitching(false);
    if (result?.ok) {
      setReport((current) => ({
        ...current,
        blockUnlinkedPublish: result.data.blockUnlinkedPublish,
      }));
      toast.success(
        result.data.blockUnlinkedPublish
          ? "Unlinked originals can no longer be published"
          : "Unlinked originals can be published again",
      );
      return;
    }
    toast.error(
      result ? adminMutationErrorMessage(result) : "Could not change the setting. Try again.",
    );
  }

  const afterLink = () => void checkAgain();
  const bulkPlan = planBulkLink(report.matched);
  const groups = groupRows(report);
  const done = report.counts.unlinked === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={FROM_ZOHO_TITLE} description={FROM_ZOHO_DESCRIPTION} />
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <div className="border-b border-staff-line-subtle px-2">{views}</div>
        {done ? (
          <EmptyState
            illustration="plinth"
            title="Every lax.art original is linked to Zoho"
            description="The one-place lock and moves now cover every original on lax.art. This tab is hidden until a new original needs linking."
          />
        ) : (
          <div className="flex flex-col gap-6 p-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-staff text-staff-md font-semibold text-staff-fg">
                Link lax.art originals to Zoho
              </h2>
              <p className="max-w-prose text-staff-sm text-staff-muted">
                These originals were put on lax.art before the register, so the one-place lock and
                moves don't cover them yet. Each is matched to its Zoho record by stock code, or by
                artist and title. Nothing is linked until you confirm. Where lax.art and Zoho
                disagree, Zoho's value replaces lax.art's. Web addresses never change.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-staff-sm text-staff-muted">
                Checked {formatStaffDateTime(report.checkedAt)}
              </p>
              <StaffButton
                variant="secondary"
                size="sm"
                loading={checking}
                onClick={() => void checkAgain()}
              >
                Check again
              </StaffButton>
            </div>
            {checkError ? (
              <Notice tone="danger" alert title="Could not check again">
                {checkError}
              </Notice>
            ) : null}
            {canLink ? null : (
              <Notice tone="info" title="View only">
                You can see how each artwork matches. Linking needs the Catalogue editor or
                Administrator role.
              </Notice>
            )}

            <StatGrid
              label="Link lax.art"
              items={[
                { id: "unlinked", label: "Not linked", value: String(report.counts.unlinked) },
                { id: "matched", label: "Matched", value: String(report.counts.matched) },
                { id: "choice", label: "Needs a choice", value: String(report.counts.needsChoice) },
                { id: "none", label: "No match", value: String(report.counts.noMatch) },
              ]}
            />

            <section
              aria-label="Publishing unlinked originals"
              className="flex flex-wrap items-center justify-between gap-3 rounded-staff-md border border-staff-line p-3"
            >
              <div className="min-w-0">
                <h3 className="text-staff-sm font-semibold text-staff-fg">
                  Block publishing unlinked originals
                </h3>
                <p className="text-staff-xs text-staff-muted">
                  {report.blockUnlinkedPublish
                    ? "On. An original that is not linked to Zoho cannot be published."
                    : "Off. Turn it on once this report is done."}
                  {canSwitch ? "" : " Only an Administrator can change it."}
                </p>
              </div>
              <StaffSwitch
                aria-label="Block publishing unlinked originals"
                checked={report.blockUnlinkedPublish}
                disabled={!canSwitch || switching}
                onCheckedChange={(next: boolean) => void toggleSwitch(next)}
              />
            </section>

            {groups.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`link-group-${group.id}`}
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id={`link-group-${group.id}`}
                    className="font-staff text-staff-md font-semibold text-staff-fg"
                  >
                    {group.label} <span className="text-staff-muted">({group.rows.length})</span>
                  </h3>
                  {group.id === "matched" && canLink && bulkPlan.links.length > 0 ? (
                    <StaffButton variant="primary" size="sm" onClick={() => setBulk(true)}>
                      Link {bulkPlan.links.length} matched…
                    </StaffButton>
                  ) : null}
                </div>
                {group.rows.length === 0 ? (
                  <p className="text-staff-sm text-staff-muted">
                    {group.id === "matched"
                      ? "Nothing matched yet."
                      : group.id === "needsChoice"
                        ? "Nothing needs a choice."
                        : "Every artwork has a match."}
                  </p>
                ) : (
                  <ul className="rounded-staff-md border border-staff-line-subtle">
                    {group.rows.map((row) => (
                      <li key={row.listing.artworkId} className={rowClass}>
                        <ListingSummary row={row} />
                        {group.id === "matched" && row.candidates[0] ? (
                          <div className="flex flex-col gap-2 sm:items-end">
                            <CandidateLine candidate={row.candidates[0]} />
                            <p className="text-staff-xs text-staff-muted">
                              {row.rule ? LINK_RULE_LABEL[row.rule] : null}
                            </p>
                            {canLink ? (
                              <StaffButton
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setReview({
                                    row,
                                    candidate: row.candidates[0] as AdminZohoLinkCandidate,
                                  })
                                }
                              >
                                Review and link…
                              </StaffButton>
                            ) : null}
                          </div>
                        ) : null}
                        {group.id === "needsChoice" ? (
                          <ul
                            aria-label={`Records that could be ${row.listing.title}`}
                            className="flex min-w-0 flex-col gap-3 sm:items-end"
                          >
                            {row.candidates.map((candidate) => (
                              <li
                                key={candidate.record.registerId}
                                className="flex flex-col gap-1 sm:items-end"
                              >
                                <CandidateLine candidate={candidate} />
                                {canLink ? (
                                  <StaffButton
                                    variant="secondary"
                                    size="sm"
                                    aria-label={`Choose ${candidate.record.stockCode} for ${row.listing.title}`}
                                    onClick={() => setReview({ row, candidate })}
                                  >
                                    Choose this one…
                                  </StaffButton>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {group.id === "noMatch" ? (
                          <div className="flex flex-col gap-2 sm:items-end">
                            <p className="max-w-sm text-staff-sm text-staff-muted sm:text-right">
                              {row.reason ? NO_MATCH_REASON_LABEL[row.reason] : "No match"}
                            </p>
                            {canLink ? (
                              <StaffButton
                                variant="secondary"
                                size="sm"
                                onClick={() => setFinding(row)}
                              >
                                Find in Zoho…
                              </StaffButton>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {review ? (
        <LinkConfirmDialog
          key={`${review.row.listing.artworkId}:${review.candidate.record.registerId}`}
          open
          onOpenChange={(open) => {
            if (!open) setReview(null);
          }}
          listing={review.row.listing}
          candidate={review.candidate}
          rule={review.row.rule}
          onLinked={afterLink}
        />
      ) : null}
      {finding ? (
        <LinkToZohoDialog
          key={finding.listing.artworkId}
          open
          onOpenChange={(open) => {
            if (!open) setFinding(null);
          }}
          artworkId={finding.listing.artworkId}
          artworkTitle={finding.listing.title}
          onLinked={afterLink}
        />
      ) : null}
      {bulk ? (
        <BulkLinkDialog
          open
          onOpenChange={(open) => {
            if (!open) setBulk(false);
          }}
          matched={report.matched}
          onDone={afterLink}
        />
      ) : null}
    </div>
  );
}
