"use client";

import { SavedRepliesMenu } from "@/components/admin/consignment-inbox/saved-replies-menu";
import type { useThreadComposer } from "@/components/admin/consignment-inbox/use-thread-composer";
import { markConsignmentThreadReadAction } from "@/lib/actions/consignment-inbox";
import {
  ACCEPTED_FILE_TYPES,
  attachBlockedReason,
  attachmentErrorSentence,
  sendBlockedReason,
} from "@/lib/admin/consignment-inbox/composer-files";
import { replyRolesSentence } from "@/lib/admin/consignment-inbox/inbox-access";
import {
  buildThreadView,
  firstUnreadClientMessageId,
  replyPlaceholder,
  replyRecipients,
  sendLabel,
  threadHeading,
  threadTime,
} from "@/lib/admin/consignment-inbox/thread-view";
import { firstNameOf } from "@auction/domain";
import {
  MessageComposer,
  MessageThread,
  Notice,
  StaffButton,
  type ThreadItem,
  initialsOf,
} from "@auction/staff-ui";
import type { ConsignmentThreadDetail } from "@auction/validators";
import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  detail: ConsignmentThreadDetail;
  composer: ReturnType<typeof useThreadComposer>;
  viewerName: string;
  /** Sales managers and administrators reach the saved replies list from the menu. */
  canManageSavedReplies: boolean;
};

/**
 * The thread and its composer, the same in the inbox and on the consignment's Messages tab.
 * Opening it marks the client's messages read for people who answer (a read-only colleague
 * reading along never clears the team's unread), and it refreshes when the window regains focus
 * so a reply from the client appears without a reload.
 */
export function ConsignmentThreadPanel({
  detail,
  composer,
  viewerName,
  canManageSavedReplies,
}: Props) {
  const router = useRouter();
  const submissionId = detail.submission.id;
  const canReply = detail.abilities.canReply;
  const [expanded, setExpanded] = useState(false);
  // Fixed when the page opens, so the "New" marker stays where it was while the person reads.
  const [firstUnreadId] = useState(() => firstUnreadClientMessageId(detail));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (canReply && detail.unread > 0) void markConsignmentThreadReadAction(submissionId);
  }, [canReply, detail.unread, submissionId]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [router]);

  const view = useMemo(
    () =>
      buildThreadView(detail, {
        now,
        firstUnreadId,
        expanded,
        accountName: detail.account?.name ?? null,
      }),
    [detail, now, firstUnreadId, expanded],
  );

  const pending = composer.pending;
  const items: ThreadItem[] = pending
    ? [
        ...view.items,
        {
          type: "message",
          id: pending.id,
          author: { name: viewerName, initials: initialsOf(viewerName), side: "staff" },
          note: pending.mode === "note",
          time: threadTime(new Date().toISOString(), now),
          body: pending.body,
          attachments: [],
          delivery:
            pending.state === "sending"
              ? { state: "sending" }
              : {
                  state: "failed",
                  message: "Not sent. Check your connection.",
                  onRetry: composer.retry,
                  onEdit: composer.edit,
                },
        },
      ]
    : view.items;

  const heading = threadHeading(detail);
  const sender = detail.people.sender?.name ?? null;
  const changed = composer.changed;
  const newest = changed?.at(-1);

  return (
    <section
      aria-label={heading.title}
      className="rounded-staff-lg border border-staff-line bg-staff-surface"
    >
      <header className="flex items-center gap-2 border-b border-staff-line-subtle px-4 py-3">
        <h2 className="font-staff text-staff-md font-semibold text-staff-fg">{heading.title}</h2>
        {heading.count ? <p className="text-staff-sm text-staff-muted">{heading.count}</p> : null}
      </header>
      <MessageThread
        items={items}
        label={heading.title}
        earlier={
          view.hiddenCount > 0 ? { count: view.hiddenCount, onShow: () => setExpanded(true) } : null
        }
        empty={
          <p className="text-staff-sm text-staff-muted">
            No messages yet. When {detail.account?.name ?? "the client"} writes about this work, the
            thread starts here.
          </p>
        }
      />
      <div className="border-t border-staff-line-subtle px-4 py-3">
        {canReply ? (
          <MessageComposer
            mode={composer.mode}
            onModeChange={composer.setMode}
            value={composer.body}
            onValueChange={composer.setBody}
            onSubmit={() => composer.send()}
            placeholder={replyPlaceholder(detail)}
            recipients={replyRecipients(detail)}
            sendLabel={sendLabel(detail)}
            sending={pending?.state === "sending"}
            sendBlockedReason={sendBlockedReason(composer.body, composer.files)}
            attachments={composer.files.map((file) => ({
              id: file.id,
              name: file.name,
              kind: file.kind,
              size: file.size,
              progress: file.status === "uploading" ? file.progress : null,
              error: file.error,
            }))}
            onAttach={composer.attach}
            onRemoveAttachment={composer.removeFile}
            accept={ACCEPTED_FILE_TYPES}
            attachBlockedReason={attachBlockedReason(composer.files)}
            attachmentError={attachmentErrorSentence(composer.files)}
            textareaRef={composer.textarea}
            tools={
              composer.mode === "reply" ? (
                <SavedRepliesMenu
                  canManage={canManageSavedReplies}
                  values={{
                    clientFirstName: firstNameOf(sender),
                    workTitle: detail.submission.title,
                    saleName: detail.facts.sale?.name ?? null,
                  }}
                  onInsert={(text) => {
                    composer.setBody(
                      composer.body.trim() ? `${composer.body.trimEnd()}\n\n${text}` : text,
                    );
                    composer.focus("reply");
                  }}
                />
              ) : null
            }
            notice={
              changed && changed.length > 0 && newest ? (
                <Notice
                  tone="warning"
                  title={`${newest.author.name} wrote again while you were typing`}
                  actions={
                    <>
                      <StaffButton size="sm" onClick={composer.review}>
                        Review first
                      </StaffButton>
                      <StaffButton size="sm" variant="ghost" onClick={() => composer.send(true)}>
                        Send anyway
                      </StaffButton>
                    </>
                  }
                >
                  “{newest.body || "Sent a file"}” · {threadTime(newest.createdAt, now).label}
                </Notice>
              ) : null
            }
          />
        ) : (
          <div className="flex gap-3 py-1">
            <Eye
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-staff-muted"
              strokeWidth={1.75}
            />
            <div className="text-staff-sm">
              <p className="text-staff-fg">You can read this thread but not reply.</p>
              <p className="text-staff-muted">{replyRolesSentence()}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
