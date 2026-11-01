"use client";

import {
  discardFailedJobsAction,
  restoreFailedJobsAction,
  retryFailedJobsAction,
} from "@/lib/actions/admin/admin-failed-jobs";
import { type FailedJobOutcome, outcomeToast } from "@/lib/admin/failed-jobs/failed-job-outcome";
import { notify } from "@/lib/ui/notify";
import type { FailedJobDiscardReason, FailedJobSummary } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { DiscardFailedJobsDialog } from "./discard-failed-jobs-dialog";
import { RetryFailedJobsDialog } from "./retry-failed-jobs-dialog";

/** The three server actions the hook calls; injectable so the flow can be tested on its own. */
export type FailedJobActions = {
  retry: typeof retryFailedJobsAction;
  discard: typeof discardFailedJobsAction;
  restore: typeof restoreFailedJobsAction;
};

const SERVER_ACTIONS: FailedJobActions = {
  retry: retryFailedJobsAction,
  discard: discardFailedJobsAction,
  restore: restoreFailedJobsAction,
};

type Failure = { message: string; details: string[] };

type Asking = { kind: "retry" | "discard"; jobs: readonly FailedJobSummary[] };

function failureOf(outcome: FailedJobOutcome, doneVerb: string): Failure {
  return {
    message:
      outcome.succeeded > 0
        ? `${outcome.succeeded} ${doneVerb}, ${outcome.failures.length} did not`
        : `Nothing was ${doneVerb}`,
    details: [...new Set(outcome.failures.map((failure) => failure.message))].slice(0, 3),
  };
}

/**
 * Retry, discard and restore for one failed job or a selection: the dialogs that ask first, the
 * calls, a toast on success (a discard offers Undo), and a failure that stays in the dialog with
 * the reason for each refusal. The list refreshes after any change.
 */
export function useFailedJobActions(actions: FailedJobActions = SERVER_ACTIONS) {
  const router = useRouter();
  const [asking, setAsking] = useState<Asking | null>(null);
  // A new question starts with empty fields, whatever was typed into the last one.
  const [askId, setAskId] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, startTransition] = useTransition();

  const close = useCallback(() => {
    setAsking(null);
    setFailure(null);
  }, []);

  const restore = useCallback(
    (ids: string[]) => {
      startTransition(async () => {
        const result = await actions.restore({ ids });
        if (result.ok && result.data && result.data.failures.length === 0) {
          notify.success(outcomeToast("Restored", result.data));
        } else {
          notify.error(
            result.ok
              ? (result.data?.failures[0]?.message ?? "The jobs could not be restored.")
              : result.error,
          );
        }
        router.refresh();
      });
    },
    [actions, router],
  );

  const retry = useCallback((jobs: readonly FailedJobSummary[]) => {
    setFailure(null);
    setAskId((id) => id + 1);
    setAsking({ kind: "retry", jobs });
  }, []);

  const discard = useCallback((jobs: readonly FailedJobSummary[]) => {
    setFailure(null);
    setAskId((id) => id + 1);
    setAsking({ kind: "discard", jobs });
  }, []);

  const confirmRetry = (details: { confirmRepeat: boolean; ids: string[] }) => {
    setFailure(null);
    startTransition(async () => {
      const result = await actions.retry(details);
      if (!result.ok || !result.data) {
        setFailure({
          message: "The retry did not go through",
          details: [result.ok ? "" : result.error].filter(Boolean),
        });
        return;
      }
      if (result.data.failures.length > 0) {
        setFailure(failureOf(result.data, "retried"));
        if (result.data.succeeded > 0) router.refresh();
        return;
      }
      close();
      notify.success(outcomeToast("Retrying", result.data));
      router.refresh();
    });
  };

  const confirmDiscard = (details: {
    ids: string[];
    reason: FailedJobDiscardReason;
    note: string;
  }) => {
    setFailure(null);
    startTransition(async () => {
      const result = await actions.discard({
        ids: details.ids,
        reason: details.reason,
        ...(details.note ? { note: details.note } : {}),
      });
      if (!result.ok || !result.data) {
        setFailure({
          message: "The discard did not go through",
          details: [result.ok ? "" : result.error].filter(Boolean),
        });
        return;
      }
      if (result.data.failures.length > 0) {
        setFailure(failureOf(result.data, "discarded"));
        if (result.data.succeeded > 0) router.refresh();
        return;
      }
      const discardedIds = details.ids;
      close();
      notify.success(outcomeToast("Discarded", result.data), {
        action: { label: "Undo", onClick: () => restore(discardedIds) },
      });
      router.refresh();
    });
  };

  const dialogs = (
    <>
      <RetryFailedJobsDialog
        key={`retry-${askId}`}
        open={asking?.kind === "retry"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        jobs={asking?.kind === "retry" ? asking.jobs : []}
        busy={busy}
        failure={asking?.kind === "retry" ? failure : null}
        onConfirm={confirmRetry}
      />
      <DiscardFailedJobsDialog
        key={`discard-${askId}`}
        open={asking?.kind === "discard"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        jobs={asking?.kind === "discard" ? asking.jobs : []}
        busy={busy}
        failure={asking?.kind === "discard" ? failure : null}
        onConfirm={confirmDiscard}
      />
    </>
  );

  return { retry, discard, restore, busy, dialogs };
}
