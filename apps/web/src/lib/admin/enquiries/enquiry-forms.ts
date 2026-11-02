import type { EnquiryCloseReason } from "@auction/domain";

export const NOTE_MAX_LENGTH = 5000;

/** The note box: something to say, within the limit the API takes. */
export function validateNote(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Write the note before adding it.";
  if (trimmed.length > NOTE_MAX_LENGTH) return `Keep the note under ${NOTE_MAX_LENGTH} characters.`;
  return null;
}

export type CloseDraft = { reason: EnquiryCloseReason | null; note: string };

export type CloseField = "reason" | "note";

/** The Close dialog: a reason is required; an optional note rides along as an internal note. */
export function validateClose(draft: CloseDraft): Partial<Record<CloseField, string>> {
  const errors: Partial<Record<CloseField, string>> = {};
  if (!draft.reason) errors.reason = "Choose why you're closing this enquiry.";
  const note = draft.note.trim();
  if (note.length > NOTE_MAX_LENGTH)
    errors.note = `Keep the note under ${NOTE_MAX_LENGTH} characters.`;
  return errors;
}
