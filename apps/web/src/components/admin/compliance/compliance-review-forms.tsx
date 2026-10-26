"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  amlDecideAction,
  amlTriageAction,
  sofDecideAction,
  sofTriageAction,
} from "@/lib/actions/compliance";
import { notify } from "@/lib/ui/notify";
import { Field, Notice, Section, StaffButton, TextArea } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const NOTES_MAX = 2000;

type TriageFormProps = {
  entityId: string;
  entityKind: "aml" | "sof";
  canTriage: boolean;
  triageDone: boolean;
};

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-staff-sm text-staff-muted">{children}</p>;
}

/**
 * Step 1 of the four-eyes review: the analyst recommends clearing or blocking, with optional
 * notes. The recommendation is not binding; a different MLRO decides.
 */
export function ComplianceTriageForm({
  entityId,
  entityKind,
  canTriage,
  triageDone,
}: TriageFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  if (!canTriage) {
    return <Hint>You do not have permission to record a first-line triage.</Hint>;
  }
  if (triageDone) {
    return <Hint>Triage recorded. A different MLRO must make the binding decision.</Hint>;
  }

  const clearLabel = entityKind === "aml" ? "Recommend clear" : "Recommend approve";
  const blockLabel = entityKind === "aml" ? "Recommend block" : "Recommend reject";
  const clearValue = entityKind === "aml" ? "clear" : "approve";
  const blockValue = entityKind === "aml" ? "block" : "reject";

  const submitTriage = (recommendation: string) => {
    setFailure(null);
    startTransition(async () => {
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
        notify.success("Triage recorded — awaiting MLRO decision");
        router.refresh();
        return;
      }
      setFailure(r.error);
    });
  };

  return (
    <Section
      title="Triage recommendation"
      description="Step 1 of 2, by the analyst. The MLRO makes the binding decision."
    >
      <div className="flex flex-col gap-4">
        <Field label="Notes" optional description="Shown to the MLRO with your recommendation.">
          <TextArea
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            disabled={pending}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {failure ? (
          <Notice tone="danger" alert title="The triage was not recorded">
            {failure}
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <StaffButton variant="primary" loading={pending} onClick={() => submitTriage(clearValue)}>
            {clearLabel}
          </StaffButton>
          <StaffButton
            variant="secondary"
            disabled={pending}
            onClick={() => submitTriage(blockValue)}
          >
            {blockLabel}
          </StaffButton>
        </div>
      </div>
    </Section>
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

/**
 * Step 2: the MLRO's binding decision, by someone other than the analyst who triaged. Approving
 * goes straight through; rejecting or blocking is asked about first because the buyer stays
 * blocked until the case is reopened.
 */
export function ComplianceDecideForm({
  entityId,
  entityKind,
  canDecide,
  triageDone,
  triagedByUserId,
  currentUserId,
}: DecideFormProps) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  if (!canDecide) {
    return <Hint>Binding decisions need the MLRO role.</Hint>;
  }
  if (!triageDone) {
    return <Hint>A first-line triage must be recorded before the MLRO can decide.</Hint>;
  }

  const sameUserAsTriager =
    triagedByUserId != null && triagedByUserId.length > 0 && triagedByUserId === currentUserId;
  if (sameUserAsTriager) {
    return (
      <Notice tone="warning" title="A different MLRO must decide">
        You recorded the triage recommendation for this case, so someone else makes the binding
        decision (four-eyes).
      </Notice>
    );
  }

  const aml = entityKind === "aml";
  const clearLabel = aml ? "Clear and lift hold" : "Approve";
  const blockLabel = aml ? "Block" : "Reject";
  const clearValue = aml ? "clear" : "approve";
  const blockValue = aml ? "block" : "reject";

  const decide = async (decision: string) => {
    const r = aml
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
    return r;
  };

  const approve = () => {
    setFailure(null);
    startTransition(async () => {
      const r = await decide(clearValue);
      if (r.ok) {
        notify.success(aml ? "Screening cleared — hold lifted" : "Source of Funds approved");
        router.refresh();
        return;
      }
      setFailure(r.error);
    });
  };

  const reject = () =>
    confirm.ask({
      title: aml ? "Block this screening?" : "Reject this Source of Funds case?",
      description: aml
        ? "Blocking is terminal. Settlement holds stay in place and the buyer cannot proceed until compliance reverses the decision."
        : "Rejecting keeps settlement blocked for this buyer. They must supply new evidence and the case must be reopened before payment can proceed.",
      confirmLabel: aml ? "Block screening" : "Reject case",
      cancelLabel: aml ? "Keep screening open" : "Keep case open",
      tone: "danger",
      run: () => decide(blockValue),
      success: aml ? "Screening blocked" : "Source of Funds rejected",
    });

  return (
    <Section
      title="MLRO decision"
      description="Step 2 of 2. You must be a different person from the analyst who triaged."
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Decision notes"
          optional
          description="Kept with the decision in the audit log."
        >
          <TextArea
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            disabled={pending}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {failure ? (
          <Notice tone="danger" alert title="The decision was not recorded">
            {failure}
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <StaffButton variant="primary" loading={pending} onClick={approve}>
            {clearLabel}
          </StaffButton>
          <StaffButton variant="danger-secondary" disabled={pending} onClick={reject}>
            {blockLabel}…
          </StaffButton>
        </div>
      </div>
      {confirm.dialog}
    </Section>
  );
}
