"use client";

import { amlDecideAction, amlTriageAction } from "@/lib/actions/compliance";
import {
  AML_DECIDE_REASONS,
  type AmlCapabilities,
  type AmlRecommendation,
  type AmlStaffRow,
  amlStageAccess,
} from "@/lib/admin/compliance/aml-staff-list.vm";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  Field,
  Notice,
  type OverflowAction,
  TextArea,
  useStaffStepUp,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

/** The most the API keeps of a triage or decision note. */
export const AML_NOTES_MAX = 2000;

type Pending = {
  stage: "triage" | "decide";
  choice: AmlRecommendation;
  screening: AmlStaffRow;
} | null;

const COPY = {
  triage: {
    clear: {
      title: (client: string) => `Recommend clearing ${client}?`,
      description:
        "This is the analyst's advisory first step and does not lift any hold. A different MLRO must make the binding decision.",
      confirm: "Recommend clear",
      done: "Triage recorded: recommend clear",
      failure: "triage",
    },
    block: {
      title: (client: string) => `Recommend blocking ${client}?`,
      description:
        "This is the analyst's advisory first step and does not block anyone yet. A different MLRO must make the binding decision.",
      confirm: "Recommend block",
      done: "Triage recorded: recommend block",
      failure: "triage",
    },
  },
  decide: {
    clear: {
      title: (client: string) => `Clear the screening for ${client}?`,
      description:
        "Clearing lifts the settlement hold for this client. Your name is kept on the decision in the audit log.",
      confirm: "Clear screening",
      done: "Screening cleared and the hold lifted",
      failure: "decision",
    },
    block: {
      title: (client: string) => `Block ${client}?`,
      description:
        "Blocking is terminal. Settlement holds stay in place and the client cannot proceed until compliance reverses the decision.",
      confirm: "Block screening",
      done: "Screening blocked",
      failure: "decision",
    },
  },
} as const;

/**
 * The AML maker-checker from a row's `…` menu or the record panel: an analyst's triage
 * recommendation first, then a different MLRO's binding clear or block. Each opens a confirm
 * dialog that names the client and keeps an optional note on the audit event. The stage rules
 * match the API's: no triage without the analyst role, no decision before a triage, and never
 * the person who triaged. When the API asks for a fresh sign-in, the step-up dialog takes over.
 */
export function useAmlDecisionActions(capabilities: AmlCapabilities) {
  const router = useRouter();
  const [pending, setPendingState] = useState<Pending>(null);
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const setPending = useCallback((next: Pending) => {
    setFailure(null);
    setNotes("");
    setPendingState(next);
  }, []);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const actionsFor = useCallback(
    (screening: AmlStaffRow): OverflowAction[] => {
      const access = amlStageAccess(screening, capabilities);
      const actions: OverflowAction[] = [];
      // Once a triage is recorded the first stage is over; the panel says so.
      if (access.triage === "available") {
        for (const choice of ["clear", "block"] as const) {
          actions.push({
            id: `triage-${choice}`,
            label: COPY.triage[choice].confirm,
            onSelect: () => setPending({ stage: "triage", choice, screening }),
          });
        }
      }
      if (access.decide !== "no-permission") {
        for (const choice of ["clear", "block"] as const) {
          actions.push({
            id: `decide-${choice}`,
            label: COPY.decide[choice].confirm,
            ...(choice === "block" ? { tone: "danger" as const } : {}),
            onSelect: () => setPending({ stage: "decide", choice, screening }),
            ...(access.decide === "available"
              ? {}
              : { disabledReason: AML_DECIDE_REASONS[access.decide] }),
          });
        }
      }
      return actions;
    },
    [capabilities, setPending],
  );

  const confirm = () => {
    if (!pending) return;
    const { stage, choice, screening } = pending;
    const trimmed = notes.trim() || undefined;
    setFailure(null);
    startTransition(async () => {
      const result =
        stage === "triage"
          ? await amlTriageAction({
              screeningId: screening.id,
              recommendation: choice,
              notes: trimmed,
            })
          : await amlDecideAction({
              screeningId: screening.id,
              decision: choice,
              notes: trimmed,
            });
      if (result.ok) {
        setPending(null);
        notify.success(COPY[stage][choice].done);
        router.refresh();
        return;
      }
      if (stepUp.handle(result, `${COPY[stage][choice].confirm} for ${screening.client}`)) {
        setPending(null);
        return;
      }
      // The dialog stays open with the note typed, so the person can retry or cancel.
      setFailure(result.error);
    });
  };

  const copy = pending ? COPY[pending.stage][pending.choice] : null;
  const dialogs = (
    <>
      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={pending && copy ? copy.title(pending.screening.client) : "Confirm"}
        description={copy?.description ?? ""}
        confirmLabel={copy?.confirm ?? "Confirm"}
        tone={pending?.stage === "decide" && pending.choice === "block" ? "danger" : "default"}
        loading={busy}
        onConfirm={confirm}
      >
        {pending && copy ? (
          <div className="flex flex-col gap-3">
            {failure ? (
              <Notice tone="danger" alert title={`The ${copy.failure} did not go through`}>
                {failure}
              </Notice>
            ) : null}
            <Field
              label={pending.stage === "triage" ? "Notes" : "Decision notes"}
              optional
              description="Kept in the audit log with your name."
            >
              <TextArea
                rows={3}
                maxLength={AML_NOTES_MAX}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return {
    actionsFor,
    triage: (screening: AmlStaffRow, choice: AmlRecommendation) =>
      setPending({ stage: "triage", choice, screening }),
    decide: (screening: AmlStaffRow, choice: AmlRecommendation) =>
      setPending({ stage: "decide", choice, screening }),
    dialogs,
  };
}
