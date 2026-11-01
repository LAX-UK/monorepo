"use client";

import { AssignMenu } from "@/components/admin/consignment-inbox/assign-menu";
import { ConsignmentThreadPanel } from "@/components/admin/consignment-inbox/consignment-thread-panel";
import { ThreadFactsRail } from "@/components/admin/consignment-inbox/thread-facts-rail";
import { useInboxThreadHotkeys } from "@/components/admin/consignment-inbox/use-inbox-hotkeys";
import { useThreadActions } from "@/components/admin/consignment-inbox/use-thread-actions";
import { useThreadComposer } from "@/components/admin/consignment-inbox/use-thread-composer";
import { INBOX_PATH } from "@/lib/admin/consignment-inbox/inbox-list-state";
import { assigneeLabel, workingDuration } from "@/lib/admin/consignment-inbox/inbox-presenters";
import type { InboxThreadPager } from "@/lib/admin/consignment-inbox/load-inbox-thread-page";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { notify } from "@/lib/ui/notify";
import {
  DetailPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  RecordPager,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import type { ConsignmentThreadDetail } from "@auction/validators";
import { Archive, ExternalLink, Link2, Mail, RotateCw, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  detail: ConsignmentThreadDetail;
  list: { label: string; href: string } | null;
  pager: InboxThreadPager | null;
  viewer: { userId: string; name: string; canManageSavedReplies: boolean };
};

/**
 * A thread's page in the inbox: the header (title, status, who and how long), the pager through
 * the list it came from, the thread and composer, and the consignment's facts beside it. Send is
 * the page's one primary action, so the header holds Assign and Close as secondary buttons.
 */
export function InboxThreadView({ detail, list, pager, viewer }: Props) {
  const router = useRouter();
  const submissionId = detail.submission.id;
  const { canAssign, canClose, canReply } = detail.abilities;
  const composer = useThreadComposer({ submissionId, lastMessageId: detail.lastMessageId });
  const actions = useThreadActions({
    submissionId,
    assignee: detail.assignee,
    specialist: detail.specialist,
  });
  const [assignOpen, setAssignOpen] = useState<"assign" | "cover" | null>(null);
  const closed = detail.status === "closed";
  const status = staffStatus("consignmentThread", detail.status);
  const assignee = assigneeLabel(detail.assignee, viewer.userId);

  useInboxThreadHotkeys({
    onReply: canReply ? () => composer.focus("reply") : null,
    onNote: canReply ? () => composer.focus("note") : null,
    onAssign: canAssign ? () => setAssignOpen("assign") : null,
    onClose: canClose && !closed ? () => void actions.close() : null,
    onMarkUnread: canReply ? () => void actions.markUnread() : null,
    onNext: pager?.nextHref ? () => router.push(pager.nextHref as string) : null,
    onPrevious: pager?.previousHref ? () => router.push(pager.previousHref as string) : null,
  });

  const copyLink = () => {
    void navigator.clipboard
      ?.writeText(`${window.location.origin}${INBOX_PATH}/${submissionId}`)
      .then(() => notify.success("Link copied"));
  };

  const overflow: OverflowAction[] = [
    ...(canReply
      ? [
          {
            id: "unread",
            label: "Mark as unread",
            icon: Mail,
            shortcut: "U",
            onSelect: () => void actions.markUnread(),
          },
        ]
      : []),
    ...(canAssign && detail.specialist
      ? [
          {
            id: "cover",
            label: "Cover this thread…",
            icon: Users,
            onSelect: () => setAssignOpen("cover"),
          },
        ]
      : []),
    {
      id: "consignment",
      label: "Open consignment",
      icon: ExternalLink,
      href: `/admin/submissions/${submissionId}`,
    },
    { id: "copy-link", label: "Copy link", icon: Link2, onSelect: copyLink },
  ];

  const assignTrigger = (
    <StaffButton variant="secondary" icon={<UserPlus aria-hidden />} aria-keyshortcuts="A">
      {detail.assignee ? "Assign" : "Assign…"}
    </StaffButton>
  );

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          Link={NextLink}
          items={[
            { label: "Inbox", href: INBOX_PATH },
            ...(list ? [{ label: list.label, href: list.href }] : []),
            { label: detail.submission.reference },
          ]}
        />
      }
      {...(pager
        ? {
            pager: (
              <RecordPager
                position={pager.position}
                total={pager.total}
                previousHref={pager.previousHref}
                nextHref={pager.nextHref}
                noun="thread"
                Link={NextLink}
                navigate={(href) => router.push(href)}
                shortcuts={false}
              />
            ),
          }
        : {})}
      title={detail.submission.title}
      status={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      meta={
        <>
          {detail.account ? <MetaItem label="Client">{detail.account.name}</MetaItem> : null}
          <MetaItem label="Reference">{detail.submission.reference}</MetaItem>
          {detail.clock ? (
            <MetaItem label="Waiting">{workingDuration(detail.clock.waitedMinutes)}</MetaItem>
          ) : null}
          {detail.closed ? (
            <MetaItem label="Closed">{formatStaffDateTime(detail.closed.at)}</MetaItem>
          ) : null}
          <MetaItem label="Assigned to">{assignee ?? "No one yet"}</MetaItem>
        </>
      }
      access={canReply ? "full" : "read-only"}
      secondaryActions={
        canAssign || canClose ? (
          <>
            {canAssign ? (
              <AssignMenu
                trigger={assignTrigger}
                open={assignOpen !== null}
                onOpenChange={(open) => setAssignOpen(open ? (assignOpen ?? "assign") : null)}
                mode={assignOpen ?? "assign"}
                viewerUserId={viewer.userId}
                assigneeUserId={detail.assignee?.userId ?? null}
                specialist={detail.specialist}
                onChoose={(person) => void actions.assign(person, assignOpen === "cover")}
              />
            ) : null}
            {canClose ? (
              closed ? (
                <StaffButton
                  variant="secondary"
                  icon={<RotateCw aria-hidden />}
                  onClick={() => void actions.reopen()}
                >
                  Reopen
                </StaffButton>
              ) : (
                <StaffButton
                  variant="secondary"
                  icon={<Archive aria-hidden />}
                  aria-keyshortcuts="E"
                  onClick={() => void actions.close()}
                >
                  Close
                </StaffButton>
              )
            ) : null}
          </>
        ) : null
      }
      overflow={<OverflowMenu label="More thread actions" Link={NextLink} actions={overflow} />}
      rail={<ThreadFactsRail detail={detail} />}
      railLabel="Consignment facts"
      railPlacement="before"
    >
      <ConsignmentThreadPanel
        detail={detail}
        composer={composer}
        viewerName={viewer.name}
        canManageSavedReplies={viewer.canManageSavedReplies}
      />
      {closed ? (
        <Notice tone="info" title="Closed, no reply needed">
          It reopens and joins Unanswered if {detail.account?.name ?? "the client"} writes again.
          {canReply ? " You can still reply." : ""}
        </Notice>
      ) : null}
    </DetailPage>
  );
}
