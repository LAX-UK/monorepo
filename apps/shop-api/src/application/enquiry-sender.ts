/**
 * Who sent an enquiry. Signed-in enquiries link to the account and may also carry the
 * name and email the buyer edited in the form; guest enquiries have no account, so the
 * typed contact details are the only way to reply.
 */
export type EnquirySender =
  | {
      kind: "account";
      identitySubjectId: string;
      contactName: string | null;
      contactEmail: string | null;
    }
  | { kind: "guest"; contactName: string; contactEmail: string };

export function enquirySenderColumns(sender: EnquirySender): {
  identitySubjectId: string | null;
  contactName: string | null;
  contactEmail: string | null;
} {
  return {
    identitySubjectId: sender.kind === "account" ? sender.identitySubjectId : null,
    contactName: sender.contactName,
    contactEmail: sender.contactEmail,
  };
}

/** Rate-limit bucket for "one person": the typed email, else the account. */
export function enquirySenderRateKey(sender: EnquirySender): string {
  const email = sender.contactEmail?.toLowerCase();
  if (sender.kind === "guest" || email) return `email:${email}`;
  return `subject:${sender.identitySubjectId}`;
}
