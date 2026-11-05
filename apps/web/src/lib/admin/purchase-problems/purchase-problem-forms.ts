import { PURCHASE_PROBLEM_NOTE_MAX } from "@auction/domain";

/** The note box: something to say, within the limit the API takes. */
export function validateNote(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Write the note before adding it.";
  if (trimmed.length > PURCHASE_PROBLEM_NOTE_MAX) {
    return `Keep the note under ${PURCHASE_PROBLEM_NOTE_MAX} characters.`;
  }
  return null;
}

/** The Resolve dialog: the note says what was done, and the buyer's report cannot close without it. */
export function validateResolution(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Say what was done to resolve this.";
  if (trimmed.length > PURCHASE_PROBLEM_NOTE_MAX) {
    return `Keep the note under ${PURCHASE_PROBLEM_NOTE_MAX} characters.`;
  }
  return null;
}
