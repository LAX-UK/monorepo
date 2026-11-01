"use client";

import { SegmentedControl, ShortcutKeys } from "@auction/ui/lax";
import { CircleAlert, FileText, ImageIcon, Lock, Paperclip, Send, X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { StaffTooltip } from "../primitives/menu.js";

/**
 * Where staff answer a client, or leave a note for colleagues. Two modes that look nothing
 * alike: a reply sits in the plain box and its button names who receives it; a note sits in a
 * dashed, sunken box and its button says "Add note". The recipient line says exactly who hears
 * of a reply. Mod+Enter sends, Escape leaves the box.
 */

export type ComposerMode = "reply" | "note";

export type ComposerAttachment = {
  id: string;
  name: string;
  kind: "image" | "pdf";
  /** "340 KB", once known. */
  size?: string | null;
  /** 0–1 while uploading; null or undefined once it is ready. */
  progress?: number | null;
  /** Why the file cannot be sent ("32 MB, the limit is 15 MB"); the chip turns red. */
  error?: string | null;
};

export type MessageComposerProps = {
  mode: ComposerMode;
  /** Omit to offer replies only (no note mode). */
  onModeChange?: (mode: ComposerMode) => void;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  /** The textarea's accessible name. */
  label?: string;
  /** "Write to Northbank Gallery…". */
  placeholder: string;
  notePlaceholder?: string;
  /** "Lena Fischer, and Northbank Gallery's owners and admins, by email and in Bid." */
  recipients: string;
  noteHint?: string;
  /** "Send to Northbank Gallery"; "Send" on a narrow screen. */
  sendLabel: string;
  sendLabelShort?: string;
  sending?: boolean;
  /** Why Send is off; the button stays focusable and says so. */
  sendBlockedReason?: string | null;
  attachments?: readonly ComposerAttachment[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  /** Accepted media types for the file chooser. */
  accept?: string;
  attachBlockedReason?: string | null;
  /** A problem with the files, under the box. */
  attachmentError?: string | null;
  /** Extra tools after the attach button, e.g. the saved replies menu. */
  tools?: React.ReactNode;
  /** Above the box, e.g. "Lena wrote again while you were typing". */
  notice?: React.ReactNode;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  className?: string;
};

function AttachmentChip({
  file,
  onRemove,
}: {
  file: ComposerAttachment;
  onRemove?: (id: string) => void;
}) {
  const Icon = file.error ? CircleAlert : file.kind === "pdf" ? FileText : ImageIcon;
  const uploading = typeof file.progress === "number" && !file.error;
  return (
    <li
      className={cn(
        "inline-flex h-control-sm max-w-full items-center gap-2 rounded-staff-sm border pr-1 pl-2 text-staff-sm",
        file.error
          ? "border-staff-danger bg-staff-danger-bg text-staff-danger-fg"
          : "border-staff-line bg-staff-surface text-staff-fg",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 truncate">{file.name}</span>
      {file.error ? null : uploading ? (
        <>
          <span
            aria-hidden
            className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-staff-line"
          >
            <span
              className="block h-full rounded-full bg-staff-fg"
              style={{ width: `${Math.round((file.progress ?? 0) * 100)}%` }}
            />
          </span>
          <span className="sr-only">Uploading, {Math.round((file.progress ?? 0) * 100)}%</span>
        </>
      ) : file.size ? (
        <span className="shrink-0 text-staff-muted tabular-nums">{file.size}</span>
      ) : null}
      {onRemove ? (
        <StaffButton
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${file.name}`}
          onClick={() => onRemove(file.id)}
        >
          <X aria-hidden />
        </StaffButton>
      ) : null}
    </li>
  );
}

export function MessageComposer({
  mode,
  onModeChange,
  value,
  onValueChange,
  onSubmit,
  label,
  placeholder,
  notePlaceholder = "Write a note for colleagues…",
  recipients,
  noteHint = "Visible to Bid staff only. No one is notified.",
  sendLabel,
  sendLabelShort = "Send",
  sending = false,
  sendBlockedReason = null,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  accept,
  attachBlockedReason = null,
  attachmentError = null,
  tools,
  notice,
  textareaRef,
  className,
}: MessageComposerProps) {
  const note = mode === "note";
  const fileInput = React.useRef<HTMLInputElement>(null);
  const hintId = React.useId();
  const errorId = React.useId();
  const blocked = Boolean(sendBlockedReason);

  const submit = () => {
    if (!sending && !blocked) onSubmit();
  };

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {notice}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        {onModeChange ? (
          <SegmentedControl<ComposerMode>
            label="Message type"
            value={mode}
            onValueChange={onModeChange}
            options={[
              { value: "reply", label: "Reply" },
              { value: "note", label: "Internal note", icon: <Lock aria-hidden /> },
            ]}
          />
        ) : null}
        <p id={hintId} className="text-staff-xs text-staff-muted">
          {note ? noteHint : recipients}
        </p>
      </div>
      <div
        className={cn(
          "rounded-staff-md border transition-colors focus-within:border-staff-focus focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-staff-focus",
          note
            ? "border-dashed border-staff-control-border bg-staff-sunken"
            : "border-staff-control-border bg-staff-surface hover:border-staff-control-border-hover",
          attachmentError && "border-staff-danger",
        )}
      >
        {attachments.length > 0 ? (
          <ul aria-label="Files to send" className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((file) => (
              <AttachmentChip
                key={file.id}
                file={file}
                {...(onRemoveAttachment ? { onRemove: onRemoveAttachment } : {})}
              />
            ))}
          </ul>
        ) : null}
        <textarea
          ref={textareaRef}
          aria-label={label ?? (note ? "Internal note" : "Reply")}
          aria-describedby={attachmentError ? `${hintId} ${errorId}` : hintId}
          value={value}
          placeholder={note ? notePlaceholder : placeholder}
          rows={3}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          className="block min-h-20 w-full resize-y bg-transparent px-3 py-2.5 text-staff-md leading-[22px] text-staff-fg outline-none placeholder:text-staff-muted"
        />
        <div className="flex items-center gap-1 border-t border-staff-line-subtle px-1.5 py-1.5">
          {onAttach ? (
            <>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={accept}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const files = event.target.files ? [...event.target.files] : [];
                  event.target.value = "";
                  if (files.length > 0) onAttach(files);
                }}
              />
              {attachBlockedReason ? (
                <StaffButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Attach files"
                  disabledReason={attachBlockedReason}
                >
                  <Paperclip aria-hidden />
                </StaffButton>
              ) : (
                <StaffTooltip label="Attach photos or PDFs">
                  <StaffButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Attach files"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip aria-hidden />
                  </StaffButton>
                </StaffTooltip>
              )}
            </>
          ) : null}
          {tools}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-staff-xs text-staff-muted md:inline-flex">
              <ShortcutKeys keys="mod+enter" sequence="caps" />
              {note ? "to add" : "to send"}
            </span>
            <StaffButton
              variant={note ? "secondary" : "primary"}
              size="sm"
              loading={sending}
              icon={note ? <Lock aria-hidden /> : <Send aria-hidden />}
              aria-keyshortcuts="Meta+Enter Control+Enter"
              {...(sendBlockedReason && !sending ? { disabledReason: sendBlockedReason } : {})}
              onClick={submit}
            >
              {sending ? (
                note ? (
                  "Adding…"
                ) : (
                  "Sending…"
                )
              ) : note ? (
                "Add note"
              ) : (
                <>
                  <span className="hidden sm:inline">{sendLabel}</span>
                  <span className="sm:hidden">{sendLabelShort}</span>
                </>
              )}
            </StaffButton>
          </div>
        </div>
      </div>
      {attachmentError ? (
        <p id={errorId} className="flex items-start gap-1.5 text-staff-sm text-staff-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {attachmentError}
        </p>
      ) : null}
    </div>
  );
}
