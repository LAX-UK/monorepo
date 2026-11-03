import type { EmailBlockView, EmailLiftReason, LiftEmailBlockBody } from "@auction/types";

export type LiftDraft = {
  reason: EmailLiftReason | null;
  note: string;
  writtenRequest: boolean;
};

export type LiftField = "reason" | "note" | "writtenRequest";
export type LiftErrors = Partial<Record<LiftField, string>>;

type Rule = Pick<EmailBlockView, "liftReasons" | "noteRequired" | "writtenRequestRequired">;

/** A block that accepts one reason has it chosen already; the person only confirms it. */
export function initialLiftDraft(block: Rule): LiftDraft {
  return {
    reason: block.liftReasons.length === 1 ? (block.liftReasons[0] ?? null) : null,
    note: "",
    writtenRequest: false,
  };
}

export function noteIsRequired(block: Rule, draft: LiftDraft): boolean {
  return block.noteRequired || draft.reason === "other";
}

/** What is missing before the block can be lifted, each in words that say what to do. */
export function validateLift(block: Rule, draft: LiftDraft): LiftErrors {
  const errors: LiftErrors = {};
  if (!draft.reason) errors.reason = "Choose why you’re lifting the block.";
  if (noteIsRequired(block, draft) && !draft.note.trim()) {
    errors.note = block.writtenRequestRequired
      ? "Say where they asked, for example the enquiry or email."
      : "Add a note to explain.";
  }
  if (block.writtenRequestRequired && !draft.writtenRequest) {
    errors.writtenRequest = "Confirm they asked in writing.";
  }
  return errors;
}

/** The request body, or null while the draft is incomplete. */
export function toLiftBody(
  block: Rule & { since: string },
  draft: LiftDraft,
): LiftEmailBlockBody | null {
  if (!draft.reason || Object.keys(validateLift(block, draft)).length > 0) return null;
  const note = draft.note.trim();
  return {
    reason: draft.reason,
    expectedSince: block.since,
    ...(note ? { note } : {}),
    ...(block.writtenRequestRequired ? { writtenRequest: draft.writtenRequest } : {}),
  };
}
