import type { ConsignmentAgreement } from "@auction/types";
import { z } from "zod";

const optionalMoney = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((value) => (value === null || value === undefined ? null : String(value)));

const optionalDate = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

const agreementSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  legalEntityId: z.string(),
  termsVersion: z.string(),
  estimateLow: optionalMoney,
  estimateHigh: optionalMoney,
  reservePrice: optionalMoney,
  commissionPercent: optionalMoney,
  relistReserveFloor: optionalMoney,
  currency: z.string().default("GBP"),
  proposedAt: z.union([z.string(), z.date()]).transform((value) => new Date(value)),
  acceptedAt: optionalDate,
  acceptedByUserId: z.string().nullable().optional().default(null),
  acceptedByName: z.string().nullable().optional().default(null),
});

/** Reads an agreement from the API, or `null` when there is none or it does not parse. */
export function parseConsignmentAgreement(raw: unknown): ConsignmentAgreement | null {
  if (raw == null) return null;
  const parsed = agreementSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
