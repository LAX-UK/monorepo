"use client";

import {
  amlDecideAction,
  amlTriageAction,
  sofDecideAction,
  sofTriageAction,
} from "@/lib/actions/compliance";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const NOTES_MAX = 2000;

function TriageSubmitButtons({
  clearLabel,
  blockLabel,
  clearValue,
  blockValue,
  pending,
  onChoose,
}: {
  clearLabel: string;
  blockLabel: string;
  clearValue: string;
  blockValue: string;
  pending: boolean;
  onChoose: (recommendation: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => onChoose(clearValue)}
      >
        {pending ? "Saving…" : clearLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => onChoose(blockValue)}
      >
        {pending ? "Saving…" : blockLabel}
      </Button>
    </div>
  );
}

function DecideSubmitButtons({
  clearLabel,
  blockLabel,
  clearValue,
  blockValue,
  pending,
  onChoose,
}: {
  clearLabel: string;
  blockLabel: string;
  clearValue: string;
  blockValue: string;
  pending: boolean;
  onChoose: (decision: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="default"
        disabled={pending}
        onClick={() => onChoose(clearValue)}
      >
        {pending ? "Saving…" : clearLabel}
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => onChoose(blockValue)}
      >
        {pending ? "Saving…" : blockLabel}
      </Button>
    </div>
  );
}

type TriageFormProps = {
  entityId: string;
  entityKind: "aml" | "sof";
  canTriage: boolean;
  triageDone: boolean;
};

export function ComplianceTriageForm({
  entityId,
  entityKind,
  canTriage,
  triageDone,
}: TriageFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  if (!canTriage) {
    return (
      <p className="text-sm text-on-surface-variant">
        You do not have permission to record a first-line triage.
      </p>
    );
  }
  if (triageDone) {
    return (
      <p className="text-sm text-on-surface-variant">
        Triage recorded. A different MLRO must make the binding decision (four-eyes).
      </p>
    );
  }

  const clearLabel = entityKind === "aml" ? "Recommend clear" : "Recommend approve";
  const blockLabel = entityKind === "aml" ? "Recommend block" : "Recommend reject";
  const clearValue = entityKind === "aml" ? "clear" : "approve";
  const blockValue = entityKind === "aml" ? "block" : "reject";
  const successMessage = "Triage recorded — awaiting MLRO decision";

  const submitTriage = (recommendation: string) => {
    startTransition(() => {
      void (async () => {
        const r =
          entityKind === "aml"
            ? await amlTriageAction({
                screeningId: entityId,
                recommendation: recommendation as "clear" | "block",
                notes: notes.trim() || undefined,
              })
            : await sofTriageAction({
                caseId: entityId,
                recommendation: recommendation as "approve" | "reject",
                notes: notes.trim() || undefined,
              });
        if (r.ok) {
          notify.success(successMessage);
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-outline-variant/40 p-4">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Step 1 · Analyst triage (maker)
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${entityKind}-triage-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${entityKind}-triage-notes`}
          rows={3}
          maxLength={NOTES_MAX}
          className="resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <TriageSubmitButtons
        clearLabel={clearLabel}
        blockLabel={blockLabel}
        clearValue={clearValue}
        blockValue={blockValue}
        pending={pending}
        onChoose={submitTriage}
      />
    </div>
  );
}

type DecideFormProps = {
  entityId: string;
  entityKind: "aml" | "sof";
  canDecide: boolean;
  triageDone: boolean;
  triagedByUserId: string | null;
  currentUserId: string;
};

export function ComplianceDecideForm({
  entityId,
  entityKind,
  canDecide,
  triageDone,
  triagedByUserId,
  currentUserId,
}: DecideFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  if (!canDecide) {
    return (
      <p className="text-sm text-on-surface-variant">
        Binding MLRO decisions require the <code className="text-xs">compliance.mlro</code>{" "}
        capability.
      </p>
    );
  }
  if (!triageDone) {
    return (
      <p className="text-sm text-on-surface-variant">
        A first-line triage must be recorded before the MLRO can decide.
      </p>
    );
  }

  const sameUserAsTriager =
    triagedByUserId != null && triagedByUserId.length > 0 && triagedByUserId === currentUserId;
  if (sameUserAsTriager) {
    return (
      <p className="rounded-lg border border-warning/40 bg-warning-container/20 p-4 text-sm text-on-surface-variant">
        You recorded the triage recommendation for this case. A different MLRO must make the binding
        decision (four-eyes).
      </p>
    );
  }

  const clearLabel = entityKind === "aml" ? "Clear (lift hold)" : "Approve";
  const blockLabel = entityKind === "aml" ? "Block (terminal)" : "Reject";
  const clearValue = entityKind === "aml" ? "clear" : "approve";
  const blockValue = entityKind === "aml" ? "block" : "reject";

  const submitDecision = (decision: string) => {
    startTransition(() => {
      void (async () => {
        const r =
          entityKind === "aml"
            ? await amlDecideAction({
                screeningId: entityId,
                decision: decision as "clear" | "block",
                notes: notes.trim() || undefined,
              })
            : await sofDecideAction({
                caseId: entityId,
                decision: decision as "approve" | "reject",
                notes: notes.trim() || undefined,
              });
        if (r.ok) {
          const successMessage =
            entityKind === "aml"
              ? decision === "clear"
                ? "Screening cleared — hold lifted"
                : "Screening blocked"
              : decision === "approve"
                ? "Source of Funds approved"
                : "Source of Funds rejected";
          notify.success(successMessage);
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-container/10 p-4">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Step 2 · MLRO decision (checker)
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${entityKind}-decide-notes`}>Decision notes (optional)</Label>
        <Textarea
          id={`${entityKind}-decide-notes`}
          rows={3}
          maxLength={NOTES_MAX}
          className="resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <DecideSubmitButtons
        clearLabel={clearLabel}
        blockLabel={blockLabel}
        clearValue={clearValue}
        blockValue={blockValue}
        pending={pending}
        onChoose={submitDecision}
      />
      <p className="text-xs text-on-surface-variant">
        You must be a different user from the analyst who triaged (four-eyes).
      </p>
    </div>
  );
}
