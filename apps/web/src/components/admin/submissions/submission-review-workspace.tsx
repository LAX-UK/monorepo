"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { SubmissionSlaCell } from "@/components/admin/submissions-board/sla-cell";
import { SubmissionQualityGapCards } from "@/components/admin/submissions/submission-quality-gap-cards";
import { SubmissionReassignPicker } from "@/components/admin/submissions/submission-reassign-picker";
import {
  SubmissionReviewField,
  SubmissionReviewFieldGrid,
} from "@/components/admin/submissions/submission-review-field-grid";
import { MediaImage } from "@/components/ui/media-image";
import type { SubmissionReviewViewModel } from "@/lib/data/view-models/submission-review.vm";
import type { ItemSubmission } from "@auction/types";
import { Button, DotStatusPill } from "@auction/ui";
import Link from "next/link";

type Props = {
  vm: SubmissionReviewViewModel;
  submission: Pick<
    ItemSubmission,
    | "title"
    | "images"
    | "description"
    | "provenance"
    | "categoryId"
    | "categoryIds"
    | "convertedLotId"
    | "assignedToUserId"
  >;
  submitterDisplayName?: string | null;
  submitterUserId?: string | null;
  assigneeImage?: string | null;
  layout?: "drawer" | "page";
};

export function SubmissionReviewWorkspace({
  vm,
  submission,
  submitterDisplayName,
  submitterUserId,
  assigneeImage,
  layout = "drawer",
}: Props) {
  const heroMedia = vm.media.slice(0, 2);
  const extraMedia = vm.media.slice(2);

  return (
    <div className="space-y-6">
      {layout === "page" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge domain="submission" status={vm.status} />
            {vm.sla.label ? <SubmissionSlaCell label={vm.sla.label} tone={vm.sla.tone} /> : null}
          </div>
          <h2 className="font-headline text-xl font-semibold text-on-surface">{vm.title}</h2>
          <p className="font-body text-sm text-on-surface-variant">{vm.sellerPreview}</p>
        </div>
      ) : null}

      {heroMedia.length > 0 ? (
        <div className="space-y-3 border-b border-border-hairline pb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {heroMedia.map((item) => (
              <MediaImage
                key={item.id}
                src={item.url}
                alt={item.label}
                label={item.label}
                sizes="(max-width: 640px) 100vw, 320px"
                className="aspect-[3/2] overflow-hidden rounded-lg"
                imgClassName="size-full object-cover"
              />
            ))}
          </div>
          {extraMedia.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {extraMedia.map((item) => (
                <MediaImage
                  key={item.id}
                  src={item.url}
                  alt={item.label}
                  label={item.label}
                  sizes="80px"
                  className="size-16 overflow-hidden rounded-md"
                  imgClassName="size-full object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <SubmissionReviewFieldGrid>
        <SubmissionReviewField label="Category">{vm.categoryName ?? "—"}</SubmissionReviewField>
        <SubmissionReviewField label="Medium">{vm.medium ?? "—"}</SubmissionReviewField>
        <SubmissionReviewField label="Edition">{vm.edition ?? "—"}</SubmissionReviewField>
        <SubmissionReviewField label="Submitted">{vm.submittedLabel}</SubmissionReviewField>
        <SubmissionReviewField label="SLA">
          {vm.slaCountdown.label ? (
            <DotStatusPill label={vm.slaCountdown.label} tone={vm.slaCountdown.tone ?? "neutral"} />
          ) : (
            "—"
          )}
        </SubmissionReviewField>
        <SubmissionReviewField label="Priority">
          <DotStatusPill label={vm.priority.label} tone={vm.priority.tone} />
        </SubmissionReviewField>
      </SubmissionReviewFieldGrid>

      <SubmissionQualityGapCards gaps={vm.quality.gaps} />

      <section className="space-y-3 border-b border-border-hairline pb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Assignee
          </p>
          <SubmissionReassignPicker
            submissionId={vm.submissionId}
            status={vm.status}
            assignedToUserId={submission.assignedToUserId}
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
          {vm.assignee.isUnassigned || !vm.assignee.userId ? (
            <span className="font-body text-sm text-on-surface-variant">Unassigned</span>
          ) : (
            <>
              <AdminUserAvatar
                user={{
                  id: vm.assignee.userId,
                  name: vm.assignee.label,
                  image: assigneeImage ?? null,
                }}
                size="sm"
              />
              <span className="font-body text-base text-on-surface-variant">
                {vm.assignee.label}
              </span>
            </>
          )}
        </div>
      </section>

      {vm.askingPrice || vm.reservePrice ? (
        <SubmissionReviewFieldGrid>
          <SubmissionReviewField label="Asking">{vm.askingPrice ?? "—"}</SubmissionReviewField>
          <SubmissionReviewField label="Reserve">{vm.reservePrice ?? "—"}</SubmissionReviewField>
        </SubmissionReviewFieldGrid>
      ) : null}

      {vm.submitterNotes?.trim() ? (
        <div className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
          <p className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Submitter notes
          </p>
          <p className="font-body text-sm text-on-surface">{vm.submitterNotes}</p>
        </div>
      ) : null}

      <AdminSubmissionDecisionPanel
        submissionId={vm.submissionId}
        status={vm.status}
        submission={submission}
        {...(submitterDisplayName ? { submitterDisplayName } : {})}
        {...(submitterUserId ? { submitterUserId } : {})}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link href={`/admin/submissions/${vm.submissionId}`}>
            {layout === "drawer" ? "Open full submission" : "Overview"}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="min-h-11" asChild>
          <Link href={`/admin/submissions/${vm.submissionId}/decision`}>Decision tab</Link>
        </Button>
      </div>
    </div>
  );
}
