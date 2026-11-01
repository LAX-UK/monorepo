"use client";

import { ConsignmentThreadPanel } from "@/components/admin/consignment-inbox/consignment-thread-panel";
import { useThreadActions } from "@/components/admin/consignment-inbox/use-thread-actions";
import { useThreadComposer } from "@/components/admin/consignment-inbox/use-thread-composer";
import { inboxThreadHref } from "@/lib/admin/consignment-inbox/inbox-list-state";
import {
  assigneeLabel,
  waitingCue,
  workingDuration,
} from "@/lib/admin/consignment-inbox/inbox-presenters";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import {
  DetailColumns,
  KeyValueList,
  Section,
  StaffButton,
  StaffButtonLink,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import type { ConsignmentThreadDetail } from "@auction/validators";
import { Archive, Inbox, RotateCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const NextLink: StaffLinkComponent = Link;

/**
 * A consignment's Messages tab: the same thread and composer as the inbox, without the facts rail
 * (the page header already carries them). The side card says where the thread stands and offers
 * "Open in inbox" for people working through the queue.
 */
export function SubmissionMessagesTab({
  detail,
  viewer,
}: {
  detail: ConsignmentThreadDetail;
  viewer: { userId: string; name: string; canManageSavedReplies: boolean };
}) {
  const submissionId = detail.submission.id;
  const composer = useThreadComposer({ submissionId, lastMessageId: detail.lastMessageId });
  const actions = useThreadActions({
    submissionId,
    assignee: detail.assignee,
    specialist: detail.specialist,
  });
  const [now] = useState(() => new Date());
  const status = staffStatus("consignmentThread", detail.status);
  const cue = detail.clock ? waitingCue(detail.clock, now) : null;
  const hasThread = detail.messages.length > 0;

  const facts = [
    { label: "Status", value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
    ...(detail.clock
      ? [
          {
            label: "Waiting",
            value: (
              <span className="flex flex-col items-start gap-0.5">
                <span>{workingDuration(detail.clock.waitedMinutes)}</span>
                {cue?.kind === "badge" ? (
                  <StatusBadge tone={cue.tone}>{cue.label}</StatusBadge>
                ) : cue ? (
                  <span className="text-staff-sm text-staff-muted">{cue.label}</span>
                ) : null}
              </span>
            ),
          },
        ]
      : []),
    {
      label: "Assigned to",
      value: assigneeLabel(detail.assignee, viewer.userId) ?? "No one yet",
    },
  ];

  return (
    <DetailColumns
      railLabel="Thread"
      rail={
        hasThread ? (
          <Section title="Thread">
            <KeyValueList items={facts} />
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <StaffButtonLink
                href={inboxThreadHref(submissionId, null)}
                Link={NextLink}
                size="sm"
                icon={<Inbox aria-hidden />}
              >
                Open in inbox
              </StaffButtonLink>
              {detail.abilities.canClose ? (
                detail.status === "closed" ? (
                  <StaffButton
                    size="sm"
                    variant="ghost"
                    icon={<RotateCw aria-hidden />}
                    onClick={() => void actions.reopen()}
                  >
                    Reopen
                  </StaffButton>
                ) : (
                  <StaffButton
                    size="sm"
                    variant="ghost"
                    icon={<Archive aria-hidden />}
                    onClick={() => void actions.close()}
                  >
                    Close
                  </StaffButton>
                )
              ) : null}
            </div>
          </Section>
        ) : null
      }
    >
      <ConsignmentThreadPanel
        detail={detail}
        composer={composer}
        viewerName={viewer.name}
        canManageSavedReplies={viewer.canManageSavedReplies}
      />
    </DetailColumns>
  );
}
