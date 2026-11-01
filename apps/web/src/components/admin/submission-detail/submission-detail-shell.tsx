"use client";

import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { usePinPageAction } from "@/components/admin/staff/use-pin-page-action";
import { submissionDetailTabHref } from "@/components/admin/submission-detail/submission-detail-types";
import { MoveConsignmentDialog } from "@/components/admin/submissions/move-consignment-dialog";
import { SubmissionReassignDialog } from "@/components/admin/submissions/submission-reassign-dialog";
import { useSubmissionActions } from "@/components/admin/submissions/use-submission-actions";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { buildSubmissionHeaderBadges } from "@/lib/admin/submissions/submission-header-badges";
import { useViewerCapabilities } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { consignmentStatusMovable, evaluateSubmissionQuality } from "@auction/domain";
import {
  DetailPage,
  MetaItem,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  staffCellLinkClass,
} from "@auction/staff-ui";
import type { ItemSubmission } from "@auction/types";
import { Building2, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  submissionId: string;
  submission: ItemSubmission;
  title: string;
  documentCount: number;
  /** Client messages nobody at LAX has read: the Messages tab's count. */
  unreadMessages: number;
  submitterLegalEntityId: string | null;
  submitterDisplayName: string | null;
  assigneeDisplayName: string | null;
  currentUserId: string;
  children: ReactNode;
};

/**
 * A submission's page on the staff record template: its title and status (with the one flag that
 * most needs attention), who sent it, when and who has it, the next step as the one primary action
 * (start the review, open the decision, create the lot), the rest of the review actions in the
 * overflow menu with reject last, and its sections as tabs.
 */
export function SubmissionDetailShell({
  submissionId,
  submission,
  title,
  documentCount,
  unreadMessages,
  submitterLegalEntityId,
  submitterDisplayName,
  assigneeDisplayName,
  currentUserId,
  children,
}: Props) {
  const pathname = usePathname() ?? "";
  const { can } = useViewerCapabilities();
  const canReview = can(SUBMISSIONS_ACCESS);
  const status = staffStatus("submission", submission.status);
  const flag = useMemo(() => buildSubmissionHeaderBadges(submission)[0] ?? null, [submission]);
  const decisionHref = submissionDetailTabHref(submissionId, "decision");
  const onDecision = pathname.endsWith("/decision");
  const assignedToMe = submission.assignedToUserId === currentUserId;
  const assigned = Boolean(submission.assignedToUserId?.trim());
  const assignable = submission.status === "submitted" || submission.status === "under_review";
  const pin = usePinPageAction(title);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  // Only work that is not catalogued yet can move; the dialog says if it is not personal.
  const movable = consignmentStatusMovable(submission.status);

  const actions = useSubmissionActions({ currentUserId });
  const required = evaluateSubmissionQuality(submission).checks.some(
    (check) => check.severity === "required" && !check.ok,
  );
  const stateActions = actions.actionsFor({
    id: submissionId,
    title,
    status: submission.status,
    blocksAccept: required,
    assignedToMe,
    decisionHref,
  });
  const startReview = stateActions.find((action) => action.id === "start-review");
  const assignMe = stateActions.find((action) => action.id === "assign-me");

  const primary =
    submission.status === "submitted" && canReview && startReview && !onDecision ? (
      <StaffButton variant="primary" onClick={() => startReview.onSelect?.()}>
        Start review
      </StaffButton>
    ) : (submission.status === "under_review" || submission.status === "approved") &&
      canReview &&
      !onDecision ? (
      <StaffButton asChild variant="primary">
        <Link href={decisionHref}>
          {submission.status === "approved" ? "Create lot" : "Open decision"}
        </Link>
      </StaffButton>
    ) : submission.status === "converted" && submission.convertedLotId ? (
      <StaffButton asChild variant="primary">
        <Link href={`/admin/lots/${submission.convertedLotId}`}>Open draft lot</Link>
      </StaffButton>
    ) : null;

  const secondary =
    canReview && assignMe ? (
      <StaffButton
        variant="secondary"
        icon={<UserPlus aria-hidden />}
        onClick={() => assignMe.onSelect?.()}
      >
        Assign to me
      </StaffButton>
    ) : null;

  // Start review, assign and create lot are header buttons; the decision tab's own forms accept
  // and reject, so the menu does not offer them a second way there.
  const shownAsButtons = new Set(["start-review", "assign-me", "convert"]);
  const overflow: OverflowAction[] = [
    ...(canReview
      ? stateActions.filter((action) => {
          if (shownAsButtons.has(action.id)) return false;
          return !(onDecision && (action.id === "accept" || action.id === "reject"));
        })
      : []),
    ...(canReview && assignable
      ? [
          {
            id: "reassign",
            label: assigned ? "Reassign…" : "Assign to someone…",
            icon: UserPlus,
            onSelect: () => setReassignOpen(true),
          },
        ]
      : []),
    ...(canReview && movable
      ? [
          {
            id: "move-to-organisation",
            label: "Move to an organisation…",
            icon: Building2,
            onSelect: () => setMoveOpen(true),
          },
        ]
      : []),
    pin,
  ];
  // Destructive actions go last, after the page's own entries.
  overflow.sort((a, b) => Number(a.tone === "danger") - Number(b.tone === "danger"));

  const tabs = [
    { id: "overview", label: "Overview", href: submissionDetailTabHref(submissionId, "overview") },
    {
      id: "documents",
      label: "Documents",
      href: submissionDetailTabHref(submissionId, "documents"),
      count: documentCount,
    },
    {
      id: "messages",
      label: "Messages",
      href: submissionDetailTabHref(submissionId, "messages"),
      ...(unreadMessages > 0 ? { count: unreadMessages } : {}),
    },
    { id: "decision", label: "Decision", href: decisionHref },
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Submissions", href: "/admin/submissions" }, { label: title }]}
          />
        }
        title={title}
        status={
          <>
            <StatusBadge tone={status.tone} live={status.live ?? false}>
              {status.label}
            </StatusBadge>
            {flag ? (
              <StatusBadge tone={flag.tone === "critical" ? "danger" : "warning"}>
                {flag.label}
              </StatusBadge>
            ) : null}
          </>
        }
        meta={
          <>
            <MetaItem label="Seller">
              {submitterLegalEntityId ? (
                <Link
                  href={`/admin/legal-entities/${submitterLegalEntityId}`}
                  className={staffCellLinkClass}
                >
                  {submitterDisplayName ?? "Seller"}
                </Link>
              ) : (
                (submitterDisplayName ?? "Not known")
              )}
            </MetaItem>
            <MetaItem label="Submitted">
              <StaffDate value={submission.createdAt} withTime />
            </MetaItem>
            {assignable || assigned ? (
              <MetaItem label="Assigned to">
                {assignedToMe
                  ? "You"
                  : assigned
                    ? (assigneeDisplayName ?? "A reviewer")
                    : "No one yet"}
              </MetaItem>
            ) : null}
            {submission.convertedLotId ? (
              <MetaItem label="Lot">
                <Link
                  href={`/admin/lots/${submission.convertedLotId}`}
                  className={staffCellLinkClass}
                >
                  Open draft lot
                </Link>
              </MetaItem>
            ) : null}
          </>
        }
        primaryAction={primary}
        secondaryActions={secondary}
        overflow={
          overflow.length > 0 ? (
            <OverflowMenu label="More submission actions" Link={NextLink} actions={overflow} />
          ) : null
        }
        access={canReview ? "full" : "read-only"}
        tabs={<StaffDetailTabs label="Submission sections" items={tabs} />}
      >
        {children}
      </DetailPage>
      <MoveConsignmentDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        submissionId={submissionId}
        title={title}
      />
      <SubmissionReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        submissionId={submissionId}
        title={title}
        assignedToUserId={submission.assignedToUserId}
      />
      {actions.dialogs}
    </>
  );
}
