"use client";

import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import {
  postConsignmentThreadMessageAction,
  undoConsignmentThreadReplyAction,
} from "@/lib/actions/consignment-inbox";
import {
  type StaffComposerFile,
  fileProblem,
  readyAttachments,
} from "@/lib/admin/consignment-inbox/composer-files";
import { fileSize } from "@/lib/admin/consignment-inbox/thread-view";
import { notify } from "@/lib/ui/notify";
import type { ComposerMode } from "@auction/staff-ui";
import type { ConsignmentThreadMessageView } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const UPLOAD_KIND = "consignment_message_attachment";
const UNDO_WINDOW_MS = 10_000;

/** A reply that left the composer: on its way, or not sent and waiting for Retry or Edit. */
export type PendingReply = {
  id: string;
  body: string;
  mode: ComposerMode;
  files: StaffComposerFile[];
  state: "sending" | "failed";
};

function draftKey(submissionId: string) {
  return `bid-admin.inbox.draft.${submissionId}`;
}

function readDraft(submissionId: string): string {
  try {
    return window.sessionStorage.getItem(draftKey(submissionId)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(submissionId: string, body: string) {
  try {
    if (body) window.sessionStorage.setItem(draftKey(submissionId), body);
    else window.sessionStorage.removeItem(draftKey(submissionId));
  } catch {
    // Storage unavailable: the draft lasts for this page only.
  }
}

/**
 * The composer's work: the draft (kept in this browser per thread), reply or note mode, files
 * uploading and checked, sending without pretending it has gone, the changed-while-you-wrote
 * pause, a failure kept in place with Retry and Edit, and Undo for ten seconds after a reply.
 */
export function useThreadComposer(input: {
  submissionId: string;
  lastMessageId: string | null;
}) {
  const { submissionId } = input;
  const router = useRouter();
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [body, setBodyState] = useState("");
  const [files, setFiles] = useState<StaffComposerFile[]>([]);
  const [pending, setPending] = useState<PendingReply | null>(null);
  const [changed, setChanged] = useState<ConsignmentThreadMessageView[] | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const seen = useRef(input.lastMessageId);

  useEffect(() => {
    setBodyState(readDraft(submissionId));
  }, [submissionId]);

  // A refresh that shows newer messages is what the writer has now seen.
  useEffect(() => {
    if (!changed) seen.current = input.lastMessageId;
  }, [input.lastMessageId, changed]);

  const setBody = useCallback(
    (next: string) => {
      setBodyState(next);
      writeDraft(submissionId, next);
    },
    [submissionId],
  );

  const focus = useCallback((next?: ComposerMode) => {
    if (next) setMode(next);
    window.requestAnimationFrame(() => textarea.current?.focus());
  }, []);

  const attach = useCallback((picked: File[]) => {
    const added: Array<{ file: File; entry: StaffComposerFile }> = picked.map((file) => {
      const problem = fileProblem(file);
      return {
        file,
        entry: {
          id: crypto.randomUUID(),
          name: file.name,
          kind: file.type === "application/pdf" ? "pdf" : "image",
          size: fileSize(file.size),
          status: problem ? "rejected" : "uploading",
          progress: problem ? null : 0,
          uploadObjectId: null,
          error: problem,
        },
      };
    });
    setFiles((current) => [...current, ...added.map((a) => a.entry)]);
    for (const { file, entry } of added) {
      if (entry.status === "rejected") continue;
      const update = (patch: Partial<StaffComposerFile>) =>
        setFiles((current) => current.map((f) => (f.id === entry.id ? { ...f, ...patch } : f)));
      void uploadObjectFile(file, UPLOAD_KIND, {
        onProgress: (loaded, total) => update({ progress: total > 0 ? loaded / total : 0 }),
      })
        .then((done) =>
          update({ status: "ready", progress: null, uploadObjectId: done.uploadObjectId }),
        )
        .catch((error: unknown) =>
          update({
            status: "rejected",
            progress: null,
            error:
              error instanceof Error && error.message ? error.message : "It could not be uploaded",
          }),
        );
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id));
  }, []);

  const undo = useCallback(
    async (messageId: string, text: string) => {
      const result = await undoConsignmentThreadReplyAction(submissionId, messageId);
      if (result.ok) {
        setBody(text);
        notify.success("Reply taken back", { description: "It is back in the box to edit." });
        router.refresh();
        return;
      }
      notify.error(
        result.errorCode === "undo_expired"
          ? "The reply has already gone to the client."
          : result.error,
      );
    },
    [router, setBody, submissionId],
  );

  const deliver = useCallback(
    async (reply: PendingReply, sendAnyway: boolean) => {
      setPending({ ...reply, state: "sending" });
      const result = await postConsignmentThreadMessageAction(submissionId, {
        body: reply.body,
        attachments: readyAttachments(reply.files),
        visibility: reply.mode === "note" ? "internal" : "thread",
        lastSeenMessageId: seen.current,
        sendAnyway,
      });
      if (result.ok) {
        setPending(null);
        setChanged(null);
        writeDraft(submissionId, "");
        router.refresh();
        const message = result.data;
        if (reply.mode === "note") {
          notify.success("Note added");
        } else if (message) {
          notify.action("Reply sent", {
            duration: UNDO_WINDOW_MS,
            description: "The client hears of it in 10 seconds.",
            onAction: () => void undo(message.id, reply.body),
          });
        }
        return;
      }
      if (result.errorCode === "thread_changed") {
        const newer =
          (result.meta?.newMessages as ConsignmentThreadMessageView[] | undefined) ?? [];
        setPending(null);
        setBodyState(reply.body);
        setFiles(reply.files);
        setChanged(newer);
        return;
      }
      setPending({ ...reply, state: "failed" });
    },
    [router, submissionId, undo],
  );

  const send = useCallback(
    (sendAnyway = false) => {
      const reply: PendingReply = {
        id: crypto.randomUUID(),
        body: body.trim(),
        mode,
        files: files.filter((file) => file.status === "ready"),
        state: "sending",
      };
      setBodyState("");
      setFiles([]);
      void deliver(reply, sendAnyway);
    },
    [body, deliver, files, mode],
  );

  const retry = useCallback(() => {
    if (pending) void deliver(pending, false);
  }, [deliver, pending]);

  const edit = useCallback(() => {
    if (!pending) return;
    setBody(pending.body);
    setFiles(pending.files);
    setMode(pending.mode);
    setPending(null);
    focus();
  }, [focus, pending, setBody]);

  /** "Review first": show the new messages and keep the draft. */
  const review = useCallback(() => {
    if (changed?.length) seen.current = changed.at(-1)?.id ?? seen.current;
    setChanged(null);
    router.refresh();
    focus();
  }, [changed, focus, router]);

  return {
    mode,
    setMode,
    body,
    setBody,
    files,
    attach,
    removeFile,
    pending,
    changed,
    send,
    retry,
    edit,
    review,
    focus,
    textarea,
  };
}
