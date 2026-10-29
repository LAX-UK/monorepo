/**
 * What a refused member change says to the person. The server answers a refusal with a code
 * and, for policy refusals, a sentence already written for clients; codes without a sentence
 * get words here, so a raw code never reaches the page.
 */
export type MemberChangeFailure = { code: string | null; error: string };

const CODE_COPY: Record<string, string> = {
  already_a_member: "This person is already a member.",
  member_not_found: "This person is no longer a member. Refresh the page to see the team.",
  target_member_not_found: "This person is no longer a member. Refresh the page to see the team.",
  invitation_not_found: "This invitation has already been answered or withdrawn.",
  invitation_not_restorable: "This invitation can't be reopened. Send a new one instead.",
  confirmation_mismatch: "Type the phrase exactly as it's shown.",
  not_a_member: "You're no longer a member of this organisation.",
  insufficient_role: "Only owners and admins can manage members.",
};

const FALLBACK = "That didn't go through. Try again in a moment.";

/** A body's words: known codes first, then the server's own sentence, then a calm fallback. */
export function memberChangeFailure(body: {
  error?: unknown;
  code?: unknown;
}): MemberChangeFailure {
  const code = typeof body.code === "string" ? body.code : null;
  const error = typeof body.error === "string" ? body.error : null;
  const known = (code && CODE_COPY[code]) ?? (error && CODE_COPY[error]) ?? null;
  if (known) return { code: code ?? error, error: known };
  // A sentence written for clients (the member change policy's reasons) reads as it is.
  if (error && error !== code && /\s/.test(error)) return { code, error };
  return { code: code ?? error, error: FALLBACK };
}
