import { z } from "zod";

/** The largest signed agreement staff can attach: a scanned PDF, up to 20 MB. */
export const SIGNED_AGREEMENT_MAX_BYTES = 20 * 1024 * 1024;

/** The highest commission a recorded agreement may carry, in percent. */
export const SIGNED_AGREEMENT_MAX_COMMISSION_PERCENT = 50;

/** The shortest reason that says why the agreement is recorded by staff. */
export const SIGNED_AGREEMENT_REASON_MIN = 10;

export type SignedAgreementField = "commissionPercent" | "document" | "signedOn" | "reason";

/** One sentence per field, saying what to do. The form and the API both say these. */
export const SIGNED_AGREEMENT_MESSAGES: Readonly<Record<SignedAgreementField, string>> = {
  commissionPercent: "Enter the commission from the signed agreement, from 0% to 50%.",
  document: "Add the signed agreement as a PDF.",
  signedOn: "Enter the date it was signed.",
  reason: "Say why it's recorded here, in at least 10 characters.",
};

/** Fields in the order the form shows them, so the error summary lists them the same way. */
export const SIGNED_AGREEMENT_FIELDS: readonly SignedAgreementField[] = [
  "commissionPercent",
  "signedOn",
  "document",
  "reason",
];

export type SignedAgreementInput = {
  commissionPercent: string;
  /** A London calendar day, "2026-10-03". */
  signedOn: string;
  uploadObjectId: string | null;
  reason: string;
};

export type SignedAgreementErrors = Partial<Record<SignedAgreementField, string>>;

/** "12", "12.5" or "12.25": up to two decimals, from 0 to 50. */
const PERCENT = /^\d{1,2}(?:\.\d{1,2})?$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCommission(text: string): boolean {
  const value = text.trim().replace(/\s*%$/, "");
  return PERCENT.test(value) && Number(value) <= SIGNED_AGREEMENT_MAX_COMMISSION_PERCENT;
}

function isPastOrToday(day: string, today: string): boolean {
  const match = DAY.exec(day.trim());
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const real =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d);
  return real && day.trim() <= today;
}

/**
 * What is wrong with a signed agreement before it is recorded, field by field. `today` is the
 * London calendar day ("2026-11-13"): an agreement cannot be signed after it.
 */
export function checkSignedAgreement(
  input: SignedAgreementInput,
  today: string,
): SignedAgreementErrors {
  const errors: SignedAgreementErrors = {};
  if (!isCommission(input.commissionPercent)) {
    errors.commissionPercent = SIGNED_AGREEMENT_MESSAGES.commissionPercent;
  }
  if (!isPastOrToday(input.signedOn, today)) errors.signedOn = SIGNED_AGREEMENT_MESSAGES.signedOn;
  if (!input.uploadObjectId) errors.document = SIGNED_AGREEMENT_MESSAGES.document;
  if (input.reason.trim().length < SIGNED_AGREEMENT_REASON_MIN) {
    errors.reason = SIGNED_AGREEMENT_MESSAGES.reason;
  }
  return errors;
}

/** The commission as an agreement stores it: "12.5" → "12.50". Call only on a checked value. */
export function signedAgreementCommission(text: string): string {
  return Number(text.trim().replace(/\s*%$/, "")).toFixed(2);
}

/** POST /admin/lots/:lotId/signed-agreement */
export const recordSignedAgreementBodySchema = z.object({
  commissionPercent: z.string().max(16),
  signedOn: z.string().max(16),
  uploadObjectId: z.string().uuid().nullable(),
  reason: z.string().max(2000),
  /** Replace an agreement already on record with a corrected one (Administrator only). */
  replace: z.boolean().optional().default(false),
});

export type RecordSignedAgreementBody = z.infer<typeof recordSignedAgreementBodySchema>;
