"use client";

import {
  amlDecideAction,
  amlTriageAction,
  sofDecideAction,
  sofTriageAction,
} from "@/lib/actions/compliance";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { useFormStatus } from "react-dom";

const NOTES_MAX = 2000;

function TriageSubmitButtons({
  clearLabel,
  blockLabel,
  clearValue,
  blockValue,
}: {
  clearLabel: string;
  blockLabel: string;
  clearValue: string;
  blockValue: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="submit"
        name="recommendation"
        value={clearValue}
        variant="secondary"
        disabled={pending}
      >
        {pending ? "Saving…" : clearLabel}
      </Button>
      <Button
        type="submit"
        name="recommendation"
        value={blockValue}
        variant="outline"
        disabled={pending}
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
}: {
  clearLabel: string;
  blockLabel: string;
  clearValue: string;
  blockValue: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value={clearValue} variant="default" disabled={pending}>
        {pending ? "Saving…" : clearLabel}
      </Button>
      <Button
        type="submit"
        name="decision"
        value={blockValue}
        variant="destructive"
        disabled={pending}
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

  const action = entityKind === "aml" ? amlTriageAction : sofTriageAction;
  const idField = entityKind === "aml" ? "screeningId" : "caseId";
  const clearLabel = entityKind === "aml" ? "Recommend clear" : "Recommend approve";
  const blockLabel = entityKind === "aml" ? "Recommend block" : "Recommend reject";
  const clearValue = entityKind === "aml" ? "clear" : "approve";
  const blockValue = entityKind === "aml" ? "block" : "reject";

  return (
    <form action={action} className="space-y-3 rounded-lg border border-outline-variant/40 p-4">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Step 1 · Analyst triage (maker)
      </p>
      <input type="hidden" name={idField} value={entityId} />
      <div className="space-y-2">
        <Label htmlFor={`${entityKind}-triage-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${entityKind}-triage-notes`}
          name="notes"
          rows={3}
          maxLength={NOTES_MAX}
          className="resize-y"
        />
      </div>
      <TriageSubmitButtons
        clearLabel={clearLabel}
        blockLabel={blockLabel}
        clearValue={clearValue}
        blockValue={blockValue}
      />
    </form>
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

  const action = entityKind === "aml" ? amlDecideAction : sofDecideAction;
  const idField = entityKind === "aml" ? "screeningId" : "caseId";
  const clearLabel = entityKind === "aml" ? "Clear (lift hold)" : "Approve";
  const blockLabel = entityKind === "aml" ? "Block (terminal)" : "Reject";
  const clearValue = entityKind === "aml" ? "clear" : "approve";
  const blockValue = entityKind === "aml" ? "block" : "reject";

  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-primary/30 bg-primary-container/10 p-4"
    >
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
        Step 2 · MLRO decision (checker)
      </p>
      <input type="hidden" name={idField} value={entityId} />
      <div className="space-y-2">
        <Label htmlFor={`${entityKind}-decide-notes`}>Decision notes (optional)</Label>
        <Textarea
          id={`${entityKind}-decide-notes`}
          name="notes"
          rows={3}
          maxLength={NOTES_MAX}
          className="resize-y"
        />
      </div>
      <DecideSubmitButtons
        clearLabel={clearLabel}
        blockLabel={blockLabel}
        clearValue={clearValue}
        blockValue={blockValue}
      />
      <p className="text-xs text-on-surface-variant">
        You must be a different user from the analyst who triaged (four-eyes).
      </p>
    </form>
  );
}
