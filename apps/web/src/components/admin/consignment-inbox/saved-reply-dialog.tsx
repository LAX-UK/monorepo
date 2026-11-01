"use client";

import { createSavedReplyAction, updateSavedReplyAction } from "@/lib/actions/consignment-inbox";
import { notify } from "@/lib/ui/notify";
import {
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
  SAVED_REPLY_PLACEHOLDERS,
  SAVED_REPLY_TITLE_MAX_LENGTH,
} from "@auction/domain";
import { Field, Notice, StaffButton, StaffDialog, TextArea, TextInput } from "@auction/staff-ui";
import type { SavedReplyView } from "@auction/validators";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useTransition } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The reply being edited, or null for a new one. */
  reply: SavedReplyView | null;
};

const PLACEHOLDER_HINT = Object.values(SAVED_REPLY_PLACEHOLDERS).join(", ");

/**
 * Writes or edits a team saved reply. Validates on save, then each field again as it changes;
 * a refusal (a title already used, the list full) stays in the dialog with what was written.
 */
export function SavedReplyDialog({ open, onOpenChange, reply }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle(reply?.title ?? "");
    setBody(reply?.body ?? "");
    setTried(false);
    setFailure(null);
  }, [open, reply]);

  const titleError = tried && !title.trim() ? "Give the reply a short title." : null;
  const bodyError = tried && !body.trim() ? "Write the reply." : null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!title.trim() || !body.trim()) return;
    setFailure(null);
    startSaving(async () => {
      const input = { title: title.trim(), body: body.trim() };
      const result = reply
        ? await updateSavedReplyAction(reply.id, input)
        : await createSavedReplyAction(input);
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      notify.success(reply ? "Saved reply updated" : "Saved reply added");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      size="md"
      title={reply ? "Edit saved reply" : "New saved reply"}
      description="Shared with everyone who replies to clients. It is inserted for editing, never sent as it is."
      footer={
        <>
          <StaffButton variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" type="submit" form="saved-reply-form" loading={saving}>
            {reply ? "Save changes" : "Add saved reply"}
          </StaffButton>
        </>
      }
    >
      <form id="saved-reply-form" noValidate onSubmit={save} className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title="That was not saved">
            {failure}
          </Notice>
        ) : null}
        <Field label="Title" error={titleError}>
          <TextInput
            value={title}
            maxLength={SAVED_REPLY_TITLE_MAX_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Sale date is fixed"
          />
        </Field>
        <Field
          label="Reply"
          description={`Placeholders fill in from the thread: ${PLACEHOLDER_HINT}.`}
          error={bodyError}
        >
          <TextArea
            value={body}
            rows={7}
            maxLength={CONSIGNMENT_MESSAGE_MAX_LENGTH}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
