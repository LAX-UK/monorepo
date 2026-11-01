"use client";

import { MemberInitials } from "@/components/legal-entity/members/member-initials";
import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import { sendConsignmentMessageAction } from "@/lib/actions/consignment-messages";
import {
  type ComposerFile,
  type PendingMessage,
  composerSendState,
  pickAttachableFiles,
} from "@/lib/seller/consignment-message-composer";
import {
  CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES,
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
} from "@auction/domain";
import { Button, TextArea } from "@auction/ui/lax";
import { Paperclip, RotateCcw, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { MessageBubble } from "./consignment-message-item";

type Props = {
  submissionId: string;
  placeholder: string;
  /** The signed-in member, shown on a message while it is being sent. */
  viewer: { name: string; initials: string };
};

const ACCEPT = CONSIGNMENT_MESSAGE_ATTACHMENT_TYPES.join(",");
const UPLOAD_KIND = "consignment_message_attachment";

let nextLocalId = 0;
const localId = () => `local-${++nextLocalId}`;

/** A message being sent, or one that could not be, with Retry. */
function PendingRow({
  message,
  viewer,
  onRetry,
  onDiscard,
}: {
  message: PendingMessage;
  viewer: Props["viewer"];
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = message.status === "failed";
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <MemberInitials>{viewer.initials}</MemberInitials>
      <div className="min-w-0">
        <p className="mb-1 text-lax-12 leading-4 text-lax-muted">
          {viewer.name} · {failed ? "Not sent" : "Sending…"}
        </p>
        <MessageBubble mine>
          {message.body ? <p className="break-words whitespace-pre-line">{message.body}</p> : null}
          {message.files.length > 0 ? (
            <p className={`text-lax-13 leading-5 text-lax-muted ${message.body ? "mt-2" : ""}`}>
              {message.files.map((f) => f.name).join(", ")}
            </p>
          ) : null}
        </MessageBubble>
        {failed ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2" role="alert">
            <p className="text-lax-13 leading-5 text-lax-danger-fg">{message.error}</p>
            <div className="flex gap-2">
              <Button size="sm" icon={<RotateCcw />} onClick={onRetry}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={onDiscard}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Writing to the specialist: the words, files (photos and PDFs) and Send. A message shows at the
 * end of the thread while it is sent, and stays with Retry if it could not be; once sent, the
 * page reads the thread again. Ctrl or ⌘ with Enter sends.
 */
export function ConsignmentMessageComposer({ submissionId, placeholder, viewer }: Props) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const state = composerSendState({ body, files });

  async function upload(id: string, file: File) {
    try {
      const done = await uploadObjectFile(file, UPLOAD_KIND);
      setFiles((all) =>
        all.map((f) =>
          f.id === id ? { ...f, status: "ready", uploadObjectId: done.uploadObjectId } : f,
        ),
      );
    } catch {
      setFiles((all) => all.map((f) => (f.id === id ? { ...f, status: "failed" } : f)));
    }
  }

  function onPick(list: FileList | null) {
    if (!list) return;
    const { accepted, problem } = pickAttachableFiles([...list], files.length);
    setFileProblem(problem);
    const added = accepted.map((file) => ({ id: localId(), file }));
    setFiles((all) => [
      ...all,
      ...added.map(({ id, file }) => ({
        id,
        name: file.name,
        status: "uploading" as const,
        uploadObjectId: null,
      })),
    ]);
    for (const { id, file } of added) void upload(id, file);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function deliver(message: PendingMessage) {
    setPending((all) =>
      all.map((m) => (m.id === message.id ? { ...m, status: "sending", error: null } : m)),
    );
    const result = await sendConsignmentMessageAction(submissionId, {
      body: message.body,
      attachments: message.files.map((f) => ({
        uploadObjectId: f.uploadObjectId,
        fileName: f.name,
      })),
    }).catch(() => ({ ok: false as const, error: "Not sent. Try again." }));
    if (result.ok) {
      setPending((all) => all.filter((m) => m.id !== message.id));
      router.refresh();
      return;
    }
    setPending((all) =>
      all.map((m) => (m.id === message.id ? { ...m, status: "failed", error: result.error } : m)),
    );
  }

  function send() {
    if (!state.canSend) return;
    const message: PendingMessage = {
      id: localId(),
      body: body.trim(),
      files: files.flatMap((f) =>
        f.status === "ready" && f.uploadObjectId
          ? [{ uploadObjectId: f.uploadObjectId, name: f.name }]
          : [],
      ),
      status: "sending",
      error: null,
    };
    setPending((all) => [...all, message]);
    setBody("");
    setFiles([]);
    setFileProblem(null);
    void deliver(message);
  }

  return (
    <>
      {pending.length > 0 ? (
        <ol
          aria-label="Messages being sent"
          aria-live="polite"
          className="mt-4 flex flex-col gap-4 px-4 sm:px-6"
        >
          {pending.map((message) => (
            <PendingRow
              key={message.id}
              message={message}
              viewer={viewer}
              onRetry={() => void deliver(message)}
              onDiscard={() => setPending((all) => all.filter((m) => m.id !== message.id))}
            />
          ))}
        </ol>
      ) : null}
      <form
        className="mt-4 border-t border-lax-line-subtle px-4 pt-4 pb-5 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Message
        </label>
        <TextArea
          id={inputId}
          rows={2}
          value={body}
          placeholder={placeholder}
          maxLength={CONSIGNMENT_MESSAGE_MAX_LENGTH}
          aria-describedby={hintId}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              send();
            }
          }}
        />
        {files.length > 0 ? (
          <ul aria-label="Files to send" className="mt-2 flex flex-wrap gap-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lax-control border border-lax-line bg-lax-surface py-0.5 pr-0.5 pl-2.5 text-lax-13 leading-5 text-lax-fg"
              >
                <span className="truncate">{file.name}</span>
                {file.status === "uploading" ? (
                  <span className="shrink-0 text-lax-muted">· Checking…</span>
                ) : file.status === "failed" ? (
                  <span className="shrink-0 text-lax-danger-fg">· Not attached</span>
                ) : null}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((all) => all.filter((f) => f.id !== file.id))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p
            id={hintId}
            className={`min-w-0 flex-1 basis-48 text-lax-12 leading-4 ${fileProblem ? "text-lax-danger-fg" : "text-lax-muted"}`}
          >
            {fileProblem ?? state.hint}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => onPick(event.target.files)}
            />
            <Button
              icon={<Paperclip />}
              {...(state.attachBlockedReason ? { disabledReason: state.attachBlockedReason } : {})}
              onClick={() => {
                if (state.canAttach) fileInput.current?.click();
              }}
            >
              Attach
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={<Send />}
              {...(state.sendBlockedReason ? { disabledReason: state.sendBlockedReason } : {})}
            >
              Send
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
