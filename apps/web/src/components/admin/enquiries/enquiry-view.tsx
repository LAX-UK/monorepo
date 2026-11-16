"use client";

import {
  ENQUIRIES_PATH,
  ENQUIRY_CLOSE_REASON_LABELS,
  ENQUIRY_KIND_LABELS,
  enquiryWaiting,
  statusSentence,
} from "@/lib/admin/enquiries/enquiries.vm";
import { enquiryRecordActions } from "@/lib/admin/enquiries/enquiry-actions";
import { REPLIES_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { enquiryTimeline } from "@/lib/admin/enquiries/enquiry-timeline";
import { dealHref } from "@/lib/admin/private-sales/private-sales.vm";
import type {
  EnquiryAssignee,
  EnquiryHistoryEntry,
  EnquiryView as EnquiryRecord,
} from "@/lib/data/http/admin-enquiries.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import { notify } from "@/lib/ui/notify";
import type { EnquiryStatus } from "@auction/domain";
import { isPrivateSaleEnquiryIntent } from "@auction/domain";
import {
  DetailPage,
  MetaItem,
  Notice,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuSeparator,
  StaffMenuTrigger,
  StatusBadge,
  Timeline,
  formatStaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ChevronDown, Copy, Handshake, Undo2, UserRoundPlus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConvertEnquiryDialog } from "../private-sales/convert-enquiry-dialog";
import { AssignEnquiryDialog } from "./assign-enquiry-dialog";
import { CloseEnquiryDialog } from "./close-enquiry-dialog";
import { AttachmentsSection } from "./enquiry-attachments";
import { EnquiryStatusBadge } from "./enquiry-cells";
import { AwaitingReplyBadge, EnquiryRepliesSection } from "./enquiry-replies-section";
import {
  ClientSection,
  MessageSection,
  NotesSection,
  PrivateSaleSection,
} from "./enquiry-sections";
import { useEnquiryWrites } from "./use-enquiry-writes";

const NextLink: StaffLinkComponent = Link;

export type EnquiryViewProps = {
  enquiry: EnquiryRecord;
  assignees: EnquiryAssignee[];
  /** Assignments and status changes from the audit trail; null when it could not be read. */
  history: EnquiryHistoryEntry[] | null;
  viewerId: string;
  /** The department's name, resolved on the server; null when the enquiry has none. */
  departmentName: string | null;
  canWork: boolean;
  /** May turn a private sale enquiry into a deal. */
  canConvert?: boolean;
  /** The server's clock, so the reply time reads the same on server and browser. */
  now: string;
};

const MOVE_LABELS = {
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
} as const;

/** "Thu 12 Nov", or "Thu 12 Nov 2027" in a year other than the page's own (the server's clock). */
export function dayLabel(iso: string, now: Date): string {
  return formatStaffDate(iso, now);
}

/**
 * One enquiry on the staff record page: what the client wrote and, for private sales, the work or
 * brief in typed fields; who has it and where it stands against the two business day reply; the
 * internal notes; and its history. Assign, change status and close sit in the header and each
 * states its effect. Without the capability to work enquiries the page is view only.
 */
export function EnquiryView({
  enquiry,
  assignees,
  history,
  viewerId,
  departmentName,
  canWork,
  canConvert = false,
  now,
}: EnquiryViewProps) {
  const router = useRouter();
  const writes = useEnquiryWrites(enquiry.reference, enquiry.version);
  const actions = enquiryRecordActions(enquiry, { canWork });
  const [dialog, setDialog] = useState<"assign" | "close" | "convert" | null>(null);
  // Only a private sale enquiry that someone has started on can become a deal.
  const convertible =
    canConvert &&
    isPrivateSaleEnquiryIntent(enquiry.intent) &&
    enquiry.nextStatuses.includes("converted");
  const clock = new Date(now);

  const nameOf = (userId: string | null) =>
    userId ? assignees.find((person) => person.id === userId)?.name : undefined;
  const assignee = nameOf(enquiry.assignedToUserId);
  const waiting = enquiryWaiting(enquiry, clock);
  const events = enquiryTimeline(enquiry, nameOf, history);

  async function moveTo(status: EnquiryStatus) {
    const result = await writes.patch({ status });
    if (result.ok) notify.success(`${enquiry.reference} marked ${statusSentence(status)}`);
    else notify.error(result.error);
  }

  const moveLabel = (status: "in_progress" | "waiting_on_client") => MOVE_LABELS[status];

  const primary =
    convertible && !actions.primary ? (
      <StaffButton
        variant="primary"
        icon={<Handshake aria-hidden />}
        onClick={() => setDialog("convert")}
      >
        Convert to deal
      </StaffButton>
    ) : actions.primary ? (
      <StaffButton
        variant="primary"
        icon={actions.primary.kind === "reopen" ? <Undo2 aria-hidden /> : undefined}
        loading={writes.busy}
        onClick={() => void moveTo(actions.primary?.to ?? "in_progress")}
      >
        {actions.primary.kind === "reopen" ? "Reopen" : "Mark in progress"}
      </StaffButton>
    ) : undefined;

  const hasStatusMenu = actions.moves.length > 0 || actions.canClose;
  const secondary = (
    <>
      {actions.canAssign ? (
        <StaffButton
          variant="secondary"
          icon={<UserRoundPlus aria-hidden />}
          onClick={() => setDialog("assign")}
        >
          {enquiry.assignedToUserId ? "Reassign" : "Assign"}
        </StaffButton>
      ) : null}
      {hasStatusMenu ? (
        <StaffMenu>
          <StaffMenuTrigger asChild>
            <StaffButton variant="secondary" disabled={writes.busy}>
              Change status
              <ChevronDown aria-hidden />
            </StaffButton>
          </StaffMenuTrigger>
          <StaffMenuContent align="end">
            {actions.moves.map((status) => (
              <StaffMenuItem key={status} onSelect={() => void moveTo(status)}>
                {moveLabel(status)}
              </StaffMenuItem>
            ))}
            {actions.moves.length > 0 && actions.canClose ? <StaffMenuSeparator /> : null}
            {actions.canClose ? (
              <StaffMenuItem onSelect={() => setDialog("close")}>Close…</StaffMenuItem>
            ) : null}
          </StaffMenuContent>
        </StaffMenu>
      ) : null}
    </>
  );

  const notice =
    enquiry.status === "closed" ? (
      <Notice
        tone="info"
        title={`Closed${enquiry.closeReason ? `: ${ENQUIRY_CLOSE_REASON_LABELS[enquiry.closeReason]}` : ""}`}
      >
        {enquiry.handledAt ? `Closed on ${dayLabel(enquiry.handledAt, clock)}. ` : ""}It can be
        reopened if the client gets back in touch.
      </Notice>
    ) : enquiry.status === "converted" ? (
      <Notice tone="success" title="Converted to a deal">
        This enquiry now belongs to its deal.
      </Notice>
    ) : enquiry.awaitingReplySince ? (
      <Notice tone="warning" title={REPLIES_COPY.awaitingNoticeTitle}>
        {REPLIES_COPY.awaitingNoticeBody}
      </Notice>
    ) : undefined;

  const replyBadge =
    waiting && enquiry.status === "new" ? (
      waiting.tone === "danger" ? (
        <StatusBadge tone="danger">Reply overdue</StatusBadge>
      ) : (
        <StatusBadge tone={waiting.tone === "warning" ? "warning" : "neutral"} shape="ring">
          Reply by {dayLabel(enquiry.replyDueAt, clock)}
        </StatusBadge>
      )
    ) : null;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Enquiries", href: ENQUIRIES_PATH }, { label: enquiry.reference }]}
          />
        }
        title={`${enquiry.name} · ${ENQUIRY_KIND_LABELS[enquiry.intent]}`}
        status={
          <>
            <EnquiryStatusBadge status={enquiry.status} />
            <AwaitingReplyBadge since={enquiry.awaitingReplySince} now={clock} />
            {replyBadge}
          </>
        }
        meta={
          <>
            <MetaItem label="Reference">{enquiry.reference}</MetaItem>
            <MetaItem label="Received">{formatStaffDateTime(enquiry.receivedAt)}</MetaItem>
            <MetaItem label="Assigned to">
              {assignee ?? (enquiry.assignedToUserId ? "Former staff member" : "Nobody yet")}
            </MetaItem>
            {departmentName ? (
              <MetaItem label="Department">{departmentName}</MetaItem>
            ) : null}
          </>
        }
        access={actions.access}
        resource="Enquiries"
        {...(primary ? { primaryAction: primary } : {})}
        secondaryActions={secondary}
        overflow={
          <OverflowMenu
            label="More enquiry actions"
            Link={NextLink}
            actions={[
              {
                id: "copy-reference",
                label: "Copy reference",
                icon: Copy,
                onSelect: () => copyToClipboard(enquiry.reference, "Reference"),
              },
              { id: "back", label: "Back to the list", href: ENQUIRIES_PATH },
            ]}
          />
        }
        notice={notice}
        rail={<ClientSection enquiry={enquiry} />}
        railLabel="Client details"
      >
        <PrivateSaleSection enquiry={enquiry} />
        <MessageSection message={enquiry.message} />
        <EnquiryRepliesSection enquiry={enquiry} now={clock} />
        <AttachmentsSection reference={enquiry.reference} attachments={enquiry.attachments} />
        <NotesSection
          notes={enquiry.notes}
          nameOf={nameOf}
          editable={actions.canNote}
          add={(text) => writes.patch({ note: text })}
          onReload={writes.reload}
        />
        <Section
          id="history"
          title="History"
          description="When it arrived, each note, and every assignment and status change."
        >
          {history === null ? (
            <Notice tone="warning" title="Assignments and status changes couldn't be loaded">
              The Audit log has them. Reload the page to try again.
            </Notice>
          ) : null}
          <Timeline label="Enquiry history" events={events} />
        </Section>
      </DetailPage>
      <AssignEnquiryDialog
        open={dialog === "assign"}
        onOpenChange={(open) => setDialog(open ? "assign" : null)}
        reference={enquiry.reference}
        assignedToUserId={enquiry.assignedToUserId}
        assignees={assignees}
        viewerId={viewerId}
        submit={writes.patch}
        onReload={writes.reload}
        onDone={(_, target) =>
          notify.success(
            target
              ? `${enquiry.reference} assigned to ${nameOf(target) ?? "a colleague"}`
              : `${enquiry.reference} is unassigned`,
          )
        }
      />
      <ConvertEnquiryDialog
        open={dialog === "convert"}
        onOpenChange={(open) => setDialog(open ? "convert" : null)}
        reference={enquiry.reference}
        needsWork={enquiry.intent === "private_sale_buy"}
        onReload={writes.reload}
        onDone={(dealReference) => {
          notify.success(`${enquiry.reference} converted · ${dealReference}`);
          router.push(dealHref(dealReference));
        }}
      />
      <CloseEnquiryDialog
        open={dialog === "close"}
        onOpenChange={(open) => setDialog(open ? "close" : null)}
        reference={enquiry.reference}
        submit={writes.patch}
        onReload={writes.reload}
        onDone={(reason) =>
          notify.success(`${enquiry.reference} closed · ${ENQUIRY_CLOSE_REASON_LABELS[reason]}`)
        }
      />
    </>
  );
}
