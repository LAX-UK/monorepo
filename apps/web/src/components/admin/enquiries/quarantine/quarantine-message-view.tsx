"use client";

import { enquiryHref } from "@/lib/admin/enquiries/enquiries-search";
import { ENQUIRIES_PATH, ENQUIRY_KIND_LABELS } from "@/lib/admin/enquiries/enquiries.vm";
import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { inboundFileItems } from "@/lib/admin/enquiries/enquiry-replies";
import {
  QUARANTINE_PATH,
  reasonCopy,
  senderCheckItems,
  senderUnverified,
  subjectLine,
} from "@/lib/admin/enquiries/quarantine.vm";
import type { QuarantineMessage } from "@/lib/data/http/admin-enquiries.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import { notify } from "@/lib/ui/notify";
import {
  DetailPage,
  FileMetadataList,
  KeyValueList,
  MetaItem,
  Notice,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  TextLink,
  formatStaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { Copy, Link2, Trash2 } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachQuarantinedDialog } from "./attach-quarantined-dialog";
import { DiscardQuarantinedDialog } from "./discard-quarantined-dialog";
import { type QuarantineReviewActions, useQuarantineReview } from "./use-quarantine-review";

const NextLink: StaffLinkComponent = Link;

export type QuarantineMessageViewProps = {
  message: QuarantineMessage;
  /** May attach and discard held email; without it the page is view only. */
  canWork: boolean;
  /** The server's clock, so dates read the same on server and browser. */
  now: string;
  /** Injected in tests; the server actions otherwise. */
  actions?: QuarantineReviewActions;
};

/**
 * One held email: who sent it, why it was held and what the receiving server recorded about the
 * sender, the plain text, and the names of any files (the files were never kept). A pending email
 * can be attached to one enquiry or discarded, each after a confirmation; both are audited.
 */
export function QuarantineMessageView({
  message,
  canWork,
  now,
  actions,
}: QuarantineMessageViewProps) {
  const router = useRouter();
  const review = useQuarantineReview(message.id, actions);
  const [dialog, setDialog] = useState<"attach" | "discard" | null>(null);
  const clock = new Date(now);
  const reason = reasonCopy(message);
  const copy = QUARANTINE_COPY.record;
  const pending = message.status === "pending";
  const reviewable = pending && canWork;
  const files = inboundFileItems(message.attachments, message.id);

  const open = (next: "attach" | "discard" | null) => {
    review.clearFailure();
    setDialog(next);
  };

  const notice = !pending ? (
    <Notice
      tone={message.status === "linked" ? "success" : "info"}
      title={message.status === "linked" ? copy.reviewedLinked : copy.reviewedDismissed}
    >
      {copy.reviewedNotice(
        message.reviewedAt ? formatStaffDateTime(message.reviewedAt, clock) : "",
      )}
    </Notice>
  ) : !canWork ? (
    <Notice tone="info" title={copy.viewOnly} />
  ) : undefined;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[
              { label: "Enquiries", href: ENQUIRIES_PATH },
              { label: copy.breadcrumb, href: QUARANTINE_PATH },
              { label: subjectLine(message.subject) },
            ]}
          />
        }
        title={subjectLine(message.subject)}
        status={
          <StatusBadge tone={reason.tone} shape="dot">
            {reason.label}
          </StatusBadge>
        }
        meta={
          <>
            <MetaItem label={copy.metaFrom}>{message.fromAddress}</MetaItem>
            <MetaItem label={copy.metaReceived}>
              {formatStaffDateTime(message.receivedAt, clock)}
            </MetaItem>
            <MetaItem label={copy.metaDeleted}>{formatStaffDate(message.purgeAt, clock)}</MetaItem>
          </>
        }
        access={canWork ? "full" : "read-only"}
        resource={QUARANTINE_COPY.title}
        {...(reviewable
          ? {
              primaryAction: (
                <StaffButton
                  variant="primary"
                  icon={<Link2 aria-hidden />}
                  onClick={() => open("attach")}
                >
                  {QUARANTINE_COPY.actions.attach}
                </StaffButton>
              ),
              secondaryActions: (
                <StaffButton
                  variant="secondary"
                  icon={<Trash2 aria-hidden />}
                  onClick={() => open("discard")}
                >
                  {QUARANTINE_COPY.actions.discard}
                </StaffButton>
              ),
            }
          : {})}
        overflow={
          <OverflowMenu
            label={QUARANTINE_COPY.actions.more}
            Link={NextLink}
            actions={[
              {
                id: "copy-address",
                label: QUARANTINE_COPY.actions.copyAddress,
                icon: Copy,
                onSelect: () => copyToClipboard(message.fromAddress, "Sender address"),
              },
              { id: "back", label: QUARANTINE_COPY.actions.back, href: QUARANTINE_PATH },
            ]}
          />
        }
        notice={notice}
        rail={
          <>
            <Section id="reason" title={copy.reasonTitle}>
              <p className="m-0 text-staff-sm leading-5 text-staff-fg">{reason.description}</p>
            </Section>
            <Section id="suspect" title={copy.suspectTitle}>
              {message.suspectedEnquiry ? (
                <p className="m-0 text-staff-sm leading-5">
                  <TextLink href={enquiryHref(message.suspectedEnquiry.reference)} Link={NextLink}>
                    {message.suspectedEnquiry.reference}
                  </TextLink>
                  <span className="text-staff-muted">
                    {" "}
                    · {ENQUIRY_KIND_LABELS[message.suspectedEnquiry.intent]}
                  </span>
                </p>
              ) : (
                <p className="m-0 text-staff-sm leading-5 text-staff-muted">{copy.suspectNone}</p>
              )}
            </Section>
            <Section id="checks" title={copy.checksTitle} description={copy.checksDescription}>
              <KeyValueList items={senderCheckItems(message)} />
            </Section>
          </>
        }
        railLabel={copy.reasonTitle}
      >
        <Section id="message" title={copy.messageTitle} description={copy.messageDescription}>
          <p className="m-0 max-w-[72ch] whitespace-pre-wrap break-words text-staff-md leading-[22px] text-staff-fg">
            {message.body.trim() || QUARANTINE_COPY.noSubject}
          </p>
        </Section>
        {files.length > 0 ? (
          <Section id="files" title={copy.filesTitle}>
            <FileMetadataList files={files} label={copy.filesLabel} note={copy.filesNote} />
          </Section>
        ) : null}
      </DetailPage>
      {reviewable ? (
        <>
          <AttachQuarantinedDialog
            open={dialog === "attach"}
            onOpenChange={(next) => open(next ? "attach" : null)}
            suspectReference={message.suspectedEnquiry?.reference ?? null}
            unverified={
              senderUnverified(message)
                ? { label: reason.label, description: reason.description }
                : null
            }
            confirmationRequested={review.needsSenderConfirmation}
            busy={review.busy}
            failure={review.failure}
            onAttach={async (input) => {
              const result = await review.attach(input);
              if (result.ok && result.data) {
                setDialog(null);
                notify.success(QUARANTINE_COPY.attach.done(result.data.enquiryReference));
                router.push(enquiryHref(result.data.enquiryReference));
              }
            }}
          />
          <DiscardQuarantinedDialog
            open={dialog === "discard"}
            onOpenChange={(next) => open(next ? "discard" : null)}
            busy={review.busy}
            failure={review.failure}
            onDiscard={async (reason) => {
              const result = await review.discard(reason);
              if (result.ok) {
                setDialog(null);
                notify.success(QUARANTINE_COPY.discard.done);
              }
            }}
          />
        </>
      ) : null}
    </>
  );
}
