"use client";

import { resolveSubmissionDecisionView } from "@/lib/admin/submissions/resolve-submission-decision-view";
import { Can } from "@/lib/auth/capabilities";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRef } from "react";
import { SubmissionApproveForm } from "./submission-approve-form";
import { SubmissionConvertForm } from "./submission-convert-form";
import { SubmissionQualityChecklist } from "./submission-quality-checklist";
import { SubmissionRejectForm } from "./submission-reject-form";
import { useSubmissionDecisionActions } from "./use-submission-decision-actions";
import { useSubmissionDecisionShortcuts } from "./use-submission-decision-shortcuts";

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
  submission: Pick<
    ItemSubmission,
    | "title"
    | "images"
    | "description"
    | "provenance"
    | "categoryId"
    | "categoryIds"
    | "convertedLotId"
  >;
  /** Display name to seed the inline-create dialog when the admin clicks
   * "Use submitter as artist". Typically the submitter's legal entity name. */
  submitterDisplayName?: string;
  /** User id behind the submitter's legal entity (createdByUserId). When
   * present, inline-creating an artist links the new profile to this user
   * via {@link CreateArtistDialog.ownerUserId}. */
  submitterUserId?: string;
};

export function AdminSubmissionDecisionPanel({
  submissionId,
  status,
  submission,
  submitterDisplayName,
  submitterUserId,
}: Props) {
  const view = resolveSubmissionDecisionView(status);
  const approveFormEl = useRef<HTMLFormElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);

  const { pending, startReview, accept, reject, convert } = useSubmissionDecisionActions({
    submissionId,
  });

  useSubmissionDecisionShortcuts({
    active: view.shortcutsActive,
    panelRootRef,
    approveFormRef: approveFormEl,
  });

  const renderMode = () => {
    switch (view.mode) {
      case "start-review":
        return (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={pending}
            onClick={startReview}
          >
            Start review
          </Button>
        );
      case "review":
        return (
          <div className="space-y-8">
            <SubmissionApproveForm pending={pending} formRef={approveFormEl} onSubmit={accept} />
            <SubmissionRejectForm pending={pending} onSubmit={reject} />
          </div>
        );
      case "convert":
        return (
          <SubmissionConvertForm
            pending={pending}
            formRef={approveFormEl}
            submitterDisplayName={submitterDisplayName}
            submitterUserId={submitterUserId}
            onSubmit={convert}
          />
        );
      case "converted":
        return submission.convertedLotId ? (
          <Button className="min-h-11 w-full sm:w-auto" asChild>
            <Link href={`/admin/lots/${submission.convertedLotId}`}>Open draft lot</Link>
          </Button>
        ) : null;
      case "terminal":
        return (
          <p className="text-sm text-on-surface-variant">No further actions for this status.</p>
        );
      case "idle":
        return null;
      default: {
        const _exhaustive: never = view.mode;
        return _exhaustive;
      }
    }
  };

  return (
    <Can
      requirement={SUBMISSIONS_ACCESS}
      fallback={
        <p className="font-body text-sm text-on-surface-variant">
          You do not have permission to review submissions.
        </p>
      }
    >
      <div ref={panelRootRef} className="space-y-6">
        {view.showChecklist ? <SubmissionQualityChecklist submission={submission} /> : null}
        <p className="font-body text-xs text-on-surface-variant">
          Shortcuts when not typing in a field: <span className="font-mono">A</span>{" "}
          {view.shortcutVerb}, <span className="font-mono">R</span> focus rejection,{" "}
          <span className="font-mono">⌘ Enter</span> submit.
        </p>

        {renderMode()}
      </div>
    </Can>
  );
}
