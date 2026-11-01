"use client";

import { failedJobTimeline } from "@/lib/admin/failed-jobs/failed-job-timeline";
import { FAILED_JOBS_PATH } from "@/lib/admin/failed-jobs/failed-jobs-search";
import { FAILED_JOB_STATE_BADGE } from "@/lib/admin/failed-jobs/failed-jobs.vm";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import {
  DetailPage,
  KeyValueList,
  MetaItem,
  Notice,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  Timeline,
} from "@auction/staff-ui";
import { Copy, Lock, RotateCcw, Trash2, Undo2 } from "@auction/staff-ui/icons";
import type { FailedJobDetail } from "@auction/types";
import Link from "next/link";
import { useState } from "react";
import { useFailedJobActions } from "./use-failed-job-actions";

const NextLink: StaffLinkComponent = Link;

/** An error longer than this is folded behind "Show full error". */
const ERROR_FOLD_CHARS = 420;
const ERROR_FOLD_LINES = 6;

function ErrorBlock({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const long = message.length > ERROR_FOLD_CHARS || message.split("\n").length > ERROR_FOLD_LINES;
  return (
    <div className="flex flex-col gap-2">
      <pre
        aria-label="Error message"
        className="rounded-staff-md border border-staff-line-subtle bg-staff-sunken p-3 font-mono text-staff-xs leading-5 whitespace-pre-wrap break-words text-staff-fg"
        style={
          long && !open
            ? {
                display: "-webkit-box",
                WebkitLineClamp: ERROR_FOLD_LINES,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {message}
      </pre>
      <div className="flex items-center gap-2">
        {long ? (
          <StaffButton
            size="sm"
            variant="secondary"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Show less" : "Show full error"}
          </StaffButton>
        ) : null}
        <StaffButton
          size="sm"
          variant="secondary"
          icon={<Copy aria-hidden />}
          onClick={() => copyToClipboard(message, "Error")}
        >
          Copy error
        </StaffButton>
      </div>
    </div>
  );
}

/**
 * One failed job on the staff record page: what happened, what a retry will do, the error, the
 * masked payload and the history, with the job's facts beside them. Retry and discard sit in the
 * header for people who may act; everyone else sees the same page marked view only. A retry the
 * job's type or an operator's switch blocks is explained at the top, not just greyed out.
 */
export function FailedJobView({ job, canAct }: { job: FailedJobDetail; canAct: boolean }) {
  const actions = useFailedJobActions();
  const badge = FAILED_JOB_STATE_BADGE[job.state];
  const needsReview = job.state === "needs_review";
  const retryBlocked = needsReview && !job.retry.allowed;

  const notice = job.discard ? (
    <Notice tone="info" title="This job was discarded">
      {job.discard.reasonLabel}
      {job.discard.note ? `: ${job.discard.note}` : ""}
      {job.discard.byName ? ` Discarded by ${job.discard.byName}.` : ""}
    </Notice>
  ) : retryBlocked && job.retry.allowed === false ? (
    <Notice tone="warning" title="Retry isn't available">
      {job.retry.reason}
    </Notice>
  ) : job.state === "retried" ? (
    <Notice tone="info" title="This job has been retried">
      It runs again from the start. If it fails again, it comes back to Needs review.
    </Notice>
  ) : null;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Failed jobs", href: FAILED_JOBS_PATH }, { label: job.typeLabel }]}
          />
        }
        title={job.typeLabel}
        status={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        meta={
          <>
            <MetaItem label="Source">{job.sourceLabel}</MetaItem>
            <MetaItem label="Attempts">{job.attempts}</MetaItem>
            <MetaItem label="Last failed">
              <StaffDate value={job.lastFailedAt} withTime className="text-staff-fg" />
            </MetaItem>
          </>
        }
        access={canAct ? "full" : "read-only"}
        resource="Failed jobs"
        {...(canAct && needsReview
          ? {
              secondaryActions: (
                <StaffButton
                  variant="secondary"
                  icon={<Trash2 aria-hidden />}
                  onClick={() => actions.discard([job])}
                >
                  Discard…
                </StaffButton>
              ),
              primaryAction: (
                <StaffButton
                  variant="primary"
                  icon={<RotateCcw aria-hidden />}
                  onClick={() => actions.retry([job])}
                  {...(job.retry.allowed ? {} : { disabledReason: job.retry.reason })}
                >
                  Retry
                </StaffButton>
              ),
            }
          : {})}
        {...(canAct && job.state === "discarded"
          ? {
              primaryAction: (
                <StaffButton
                  variant="primary"
                  icon={<Undo2 aria-hidden />}
                  loading={actions.busy}
                  onClick={() => actions.restore([job.id])}
                >
                  Restore
                </StaffButton>
              ),
            }
          : {})}
        overflow={
          <OverflowMenu
            label="More job actions"
            Link={NextLink}
            actions={[
              {
                id: "copy-id",
                label: "Copy job ID",
                icon: Copy,
                onSelect: () => copyToClipboard(job.id, "Job ID"),
              },
            ]}
          />
        }
        {...(notice ? { notice } : {})}
        rail={
          <Section id="job" title="Job">
            <KeyValueList
              items={[
                ...(job.jobLabel ? [{ label: "Task", value: job.jobLabel }] : []),
                { label: "First failed", value: <StaffDate value={job.firstFailedAt} withTime /> },
                ...(job.originalJobId
                  ? [
                      {
                        label: "Original job",
                        value: job.originalJobId,
                        copyValue: job.originalJobId,
                      },
                    ]
                  : []),
                { label: "Job ID", value: job.id, copyValue: job.id },
              ]}
            />
          </Section>
        }
        railLabel="Job details"
      >
        <Section
          id="retry-effect"
          title="What a retry does"
          action={
            job.mayRepeat ? <StatusBadge tone="warning">May repeat an action</StatusBadge> : null
          }
        >
          <p className="text-staff-sm text-staff-fg">{job.retryEffect}</p>
        </Section>
        <Section id="error" title="Error">
          <ErrorBlock message={job.errorMessage} />
        </Section>
        <Section
          id="payload"
          title="Payload"
          action={<StatusBadge tone="neutral">Masked</StatusBadge>}
          description="What the job was asked to do. Personal details are partly hidden."
        >
          {job.payload.length > 0 ? (
            <KeyValueList
              items={job.payload.map((entry) => ({
                label: entry.label,
                value: entry.masked ? (
                  <span className="inline-flex items-center gap-1.5">
                    {entry.value}
                    <Lock aria-label="Masked" className="size-3 text-staff-subtle" />
                  </span>
                ) : (
                  entry.value
                ),
              }))}
            />
          ) : (
            <p className="text-staff-sm text-staff-muted">
              The job's data can't be shown here, or it carried none.
            </p>
          )}
          {job.omittedPayloadFields > 0 ? (
            <p className="mt-3 text-staff-xs text-staff-muted">
              {job.omittedPayloadFields}{" "}
              {job.omittedPayloadFields === 1 ? "field is" : "fields are"} left out. Open the client
              or lot to see their details under their own access rules.
            </p>
          ) : null}
        </Section>
        <Section id="history" title="History">
          <Timeline label="Job history" events={failedJobTimeline(job)} />
        </Section>
      </DetailPage>
      {actions.dialogs}
    </>
  );
}
