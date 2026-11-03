"use client";

import { jobCount, nounForIds } from "@/lib/admin/failed-jobs/failed-job-outcome";
import {
  ChoiceFieldset,
  ChoiceRow,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
} from "@auction/staff-ui";
import type { FailedJobSummary } from "@auction/types";
import { useId, useRef, useState } from "react";

export type RetryDialogFailure = { message: string; details: string[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: readonly FailedJobSummary[];
  busy: boolean;
  failure: RetryDialogFailure | null;
  onConfirm: (details: { confirmRepeat: boolean; ids: string[] }) => void;
};

type Group = { queue: string; label: string; count: number; mayRepeat: boolean };

function groupByType(jobs: readonly FailedJobSummary[]): Group[] {
  const groups = new Map<string, Group>();
  for (const job of jobs) {
    const group = groups.get(job.queue);
    if (group) group.count += 1;
    else {
      groups.set(job.queue, {
        queue: job.queue,
        label: job.typeLabel,
        count: 1,
        mayRepeat: job.mayRepeat,
      });
    }
  }
  return [...groups.values()];
}

/**
 * Confirms running failed jobs again. It names what runs, by type, and for types that could
 * repeat something a person sees it asks for a tick before anything starts. Jobs a retry can't
 * help (already retried, a type that is never retried from here) are left out and said so.
 */
export function RetryFailedJobsDialog({
  open,
  onOpenChange,
  jobs,
  busy,
  failure,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const tickId = useId();
  const [ticked, setTicked] = useState(false);
  const [missingTick, setMissingTick] = useState(false);

  const runnable = jobs.filter((job) => job.retry.allowed);
  const skipped = jobs.filter((job) => !job.retry.allowed);
  const groups = groupByType(runnable);
  const needsTick = runnable.some((job) => job.mayRepeat);
  const count = runnable.length;
  const noun = nounForIds(runnable.map((job) => job.id));
  // Several that failed the same way will fail again unless the cause is fixed first.
  const firstError = runnable[0]?.errorSummary;
  const sharedError =
    count > 1 && runnable.every((job) => job.errorSummary === firstError) ? firstError : null;

  const confirm = () => {
    if (needsTick && !ticked) {
      setMissingTick(true);
      return;
    }
    onConfirm({ confirmRepeat: ticked, ids: runnable.map((job) => job.id) });
  };

  const reset = (next: boolean) => {
    if (busy) return;
    if (!next) {
      setTicked(false);
      setMissingTick(false);
    }
    onOpenChange(next);
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={reset}
      initialFocusRef={cancelRef}
      title={count === 0 ? "Nothing to retry" : `Retry ${jobCount(count, noun)}?`}
      description={
        count === 0
          ? "None of the selected jobs can be retried from here."
          : `Each ${noun.one} runs once more from the start. Retries run in order, a few at a time.`
      }
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => reset(false)}
          >
            {count === 0 ? "Close" : "Cancel"}
          </StaffButton>
          {count === 0 ? null : (
            <StaffButton variant="primary" loading={busy} onClick={confirm}>
              {`Retry ${jobCount(count, noun)}`}
            </StaffButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {groups.length > 0 ? (
          <ul
            aria-label="Jobs that will run again"
            className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-md border border-staff-line"
          >
            {groups.map((group) => (
              <li key={group.queue} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-staff-sm font-medium text-staff-fg">
                  {group.count} × {group.label}
                </span>
                <span className="text-staff-xs text-staff-muted">
                  {group.mayRepeat ? "May repeat" : "Safe to repeat"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {sharedError ? (
          <Notice tone="warning" title="The same error may come back">
            All {count} failed the same way. Fix the cause first, or they will fail again.
          </Notice>
        ) : null}
        {skipped.length > 0 ? (
          <Notice tone="warning" title={`${jobCount(skipped.length, noun)} can't be retried`}>
            {skipped[0]?.retry.allowed === false ? skipped[0].retry.reason : null}
          </Notice>
        ) : null}
        {needsTick ? (
          <ChoiceFieldset
            legend="Before you retry"
            error={missingTick ? "Tick the box to confirm before retrying." : null}
          >
            <ChoiceRow
              htmlFor={tickId}
              label="I've checked these won't send anything twice."
              description="An email, or something a webhook did before it failed, could happen a second time."
              control={
                <StaffCheckbox
                  id={tickId}
                  checked={ticked}
                  disabled={busy}
                  onCheckedChange={(next) => {
                    setTicked(next === true);
                    if (next === true) setMissingTick(false);
                  }}
                />
              }
            />
          </ChoiceFieldset>
        ) : null}
        {failure ? (
          <Notice tone="danger" alert title={failure.message}>
            {failure.details.length > 0 ? (
              <ul className="list-disc pl-4">
                {failure.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </Notice>
        ) : null}
      </div>
    </StaffDialog>
  );
}
