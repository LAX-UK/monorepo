"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { TextAreaField } from "@/components/forms/fields";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { addEnquiryNote } from "@/server/application/admin-enquiry-actions.server";
import { ENQUIRY_NOTE_MAX_LENGTH, type EnquiryKind } from "@auction/shop-contracts";
import { LoadingButton } from "@auction/ui";
import { type FormEvent, useState } from "react";

/** Internal notes are for staff only and cannot be edited or removed once added. */
export function EnquiryNoteForm({ kind, id }: { kind: EnquiryKind; id: string }) {
  const mutation = useAdminMutation();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Write a note before adding it.");
      return;
    }
    setError(undefined);
    if (await mutation.run(() => addEnquiryNote({ kind, id, body }), "Note added")) setBody("");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <TextAreaField
        name="note"
        label="Add a note"
        value={body}
        onChange={setBody}
        rows={4}
        maxLength={ENQUIRY_NOTE_MAX_LENGTH}
        error={error}
        hint={`Only staff see notes, and they cannot be edited or removed. ${body.length} / ${ENQUIRY_NOTE_MAX_LENGTH}`}
      />
      <div className="flex flex-col items-start gap-2">
        <LoadingButton type="submit" loading={mutation.pending} loadingLabel="Adding…">
          Add note
        </LoadingButton>
        <AdminMutationFeedback
          message={mutation.message}
          stepUpRequired={mutation.stepUpRequired}
          stepUpHref={mutation.stepUpHref}
        />
      </div>
    </form>
  );
}
