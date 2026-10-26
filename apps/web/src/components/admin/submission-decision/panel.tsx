"use client";

import { resolveSubmissionDecisionView } from "@/lib/admin/submissions/resolve-submission-decision-view";
import { Can } from "@/lib/auth/capabilities";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  Kbd,
  Notice,
  Section,
  StaffButton,
  UnsavedChangesDialog,
  useUnsavedChanges,
} from "@auction/staff-ui";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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
  /** Display name to seed the "Use submitter as artist" dialog; typically the seller's name. */
  submitterDisplayName?: string;
  /** The account behind the seller. When present, an artist created here is linked to it. */
  submitterUserId?: string;
};

/**
 * The decision for a submission, by its status: start the review, accept it for cataloguing or
 * reject it (with a reason the seller reads), create the draft lot once accepted, or open the lot
 * once converted. What is typed is kept safe: leaving with notes unsent asks first.
 */
export function AdminSubmissionDecisionPanel({
  submissionId,
  status,
  submission,
  submitterDisplayName,
  submitterUserId,
}: Props) {
  const router = useRouter();
  const view = resolveSubmissionDecisionView(status);
  const approveFormEl = useRef<HTMLFormElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const [dirty, setDirty] = useState({ approve: false, reject: false });

  const { pending, startReview, accept, reject, convert, dialog } = useSubmissionDecisionActions({
    submissionId,
    title: submission.title,
  });

  const guard = useUnsavedChanges(dirty.approve || dirty.reject, {
    label: submission.title,
    navigate: (href) => router.push(href),
  });
  const onApproveDirty = useCallback(
    (next: boolean) => setDirty((c) => ({ ...c, approve: next })),
    [],
  );
  const onRejectDirty = useCallback(
    (next: boolean) => setDirty((c) => ({ ...c, reject: next })),
    [],
  );

  useSubmissionDecisionShortcuts({
    active: view.shortcutsActive,
    panelRootRef,
    approveFormRef: approveFormEl,
  });

  const renderMode = () => {
    switch (view.mode) {
      case "start-review":
        return (
          <Section
            title="Start the review"
            description="Starting puts it under review with you. Then you can accept it or reject it."
          >
            <StaffButton variant="primary" loading={pending} onClick={startReview}>
              Start review
            </StaffButton>
          </Section>
        );
      case "review":
        return (
          <>
            <SubmissionApproveForm
              pending={pending}
              formRef={approveFormEl}
              onSubmit={accept}
              onDirtyChange={onApproveDirty}
            />
            <SubmissionRejectForm
              pending={pending}
              onSubmit={reject}
              onDirtyChange={onRejectDirty}
            />
          </>
        );
      case "convert":
        return (
          <SubmissionConvertForm
            pending={pending}
            formRef={approveFormEl}
            submitterDisplayName={submitterDisplayName}
            submitterUserId={submitterUserId}
            onSubmit={convert}
            onDirtyChange={onApproveDirty}
          />
        );
      case "converted":
        return submission.convertedLotId ? (
          <Section title="Converted" description="This submission became a draft lot.">
            <StaffButton asChild variant="primary">
              <Link href={`/admin/lots/${submission.convertedLotId}`}>Open draft lot</Link>
            </StaffButton>
          </Section>
        ) : null;
      case "terminal":
        return <Notice tone="info" title="No further actions for this status." />;
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
      fallback={<Notice tone="info" title="You do not have permission to review submissions." />}
    >
      <div ref={panelRootRef} className="flex flex-col gap-6">
        {view.showChecklist ? <SubmissionQualityChecklist submission={submission} /> : null}
        {view.shortcutsActive ? (
          <p className="text-staff-sm text-staff-muted">
            Shortcuts when not typing in a field: <Kbd>A</Kbd> {view.shortcutVerb}, <Kbd>R</Kbd>{" "}
            focus rejection, <Kbd>⌘ Enter</Kbd> submit.
          </p>
        ) : null}
        {renderMode()}
      </div>
      {dialog}
      <UnsavedChangesDialog guard={guard} />
    </Can>
  );
}
