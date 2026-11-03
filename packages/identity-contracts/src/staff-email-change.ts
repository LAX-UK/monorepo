import { z } from "zod";

/**
 * Staff-assisted email change: the way back for someone who can no longer open the inbox that
 * the account is registered to. Bid admin asks Identity to start the change on their behalf.
 *
 * The request is served only to the `staff_email_change` machine credential, which no other
 * internal caller holds. Identity does not decide who on staff may ask: Bid checks the role and
 * the fresh sign-in, and sends the actor and the proof it recorded so Identity can log them.
 */
export const STAFF_EMAIL_CHANGE_MACHINE_SCOPE = "staff_email_change";

/** Under Identity's `/internal` machine base; the subject is the account whose address changes. */
export const STAFF_EMAIL_CHANGE_SUBROUTE = "/subjects/:subjectId/staff-email-change";

/** A reason is required so the audit entry says why the address was moved. */
export const STAFF_EMAIL_CHANGE_REASON_MIN = 10;
export const STAFF_EMAIL_CHANGE_REASON_MAX = 500;
export const STAFF_EMAIL_CHANGE_REFERENCE_MIN = 3;
export const STAFF_EMAIL_CHANGE_REFERENCE_MAX = 100;

/** What staff relied on to be sure the person asking is the account holder. */
export const STAFF_EMAIL_CHANGE_PROOF_KINDS = ["kyc_match", "id_check"] as const;
export type StaffEmailChangeProofKind = (typeof STAFF_EMAIL_CHANGE_PROOF_KINDS)[number];

export const staffEmailChangeProofSchema = z.discriminatedUnion("kind", [
  /** The caller's name and date of birth matched the verified KYC record. */
  z.object({ kind: z.literal("kyc_match"), kycSessionId: z.string().trim().min(1).max(191) }),
  /** A fresh ID check was done; the reference is where that check can be found. */
  z.object({
    kind: z.literal("id_check"),
    reference: z
      .string()
      .trim()
      .min(STAFF_EMAIL_CHANGE_REFERENCE_MIN)
      .max(STAFF_EMAIL_CHANGE_REFERENCE_MAX),
  }),
]);
export type StaffEmailChangeProof = z.infer<typeof staffEmailChangeProofSchema>;

export const staffEmailChangeRequestSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email().max(254),
  actorSubjectId: z.string().trim().min(1).max(191),
  reason: z.string().trim().min(STAFF_EMAIL_CHANGE_REASON_MIN).max(STAFF_EMAIL_CHANGE_REASON_MAX),
  proof: staffEmailChangeProofSchema,
});
export type StaffEmailChangeRequest = z.infer<typeof staffEmailChangeRequestSchema>;

export const staffEmailChangeResultSchema = z.object({ pendingEmail: z.string().min(3) }).strict();
export type StaffEmailChangeResult = z.infer<typeof staffEmailChangeResultSchema>;

/** Refusals Identity returns, so Bid can tell staff what to do next. */
export const STAFF_EMAIL_CHANGE_FAILURES = [
  "subject_not_found",
  "same_email",
  "email_taken",
  "channel_unavailable",
] as const;
export type StaffEmailChangeFailure = (typeof STAFF_EMAIL_CHANGE_FAILURES)[number];
