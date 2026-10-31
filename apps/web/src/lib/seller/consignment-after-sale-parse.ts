import {
  type ConsignmentMoveOptions,
  type SellerAfterSaleView,
  type SellerIdentityReminderState,
  type StaffAfterSaleView,
  type UnsoldLotChoice,
  consignmentAfterSaleStages,
  itemSubmissionStatuses,
  unsoldLotChoiceKinds,
  unsoldLotChoiceStatuses,
} from "@auction/types";
import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((value) => (value === null || value === undefined ? null : String(value)));

const date = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

const requiredDate = z.union([z.string(), z.date()]).transform((value) => new Date(value));
const choiceKind = z.enum(unsoldLotChoiceKinds).nullable().optional().default(null);
const name = z.string().nullable().optional().default(null);

const choiceSchema: z.ZodType<UnsoldLotChoice, z.ZodTypeDef, unknown> = z.object({
  id: z.string(),
  lotId: z.string(),
  submissionId: z.string(),
  legalEntityId: z.string(),
  lotEndTime: requiredDate,
  status: z.enum(unsoldLotChoiceStatuses),
  requestedChoice: choiceKind,
  requestedReserve: money,
  requestedByUserId: name,
  requestedByName: name,
  requestedAt: date,
  decidedChoice: choiceKind,
  decidedReserve: money,
  decidedByUserId: name,
  decidedByName: name,
  decidedAt: date,
  staffNote: name,
  currency: z.string().default("GBP"),
  createdAt: requiredDate,
  updatedAt: requiredDate,
});

const unsoldSchema = z.object({
  lotId: z.string(),
  currentReserve: money,
  reserveFloor: money,
  currency: z.string().default("GBP"),
  /** The date the choice is due by (ISO 8601); older answers leave it out. */
  chooseBy: z.string().optional(),
  choice: choiceSchema.nullable().optional().default(null),
});

const requestSchema = z
  .object({
    status: z.enum(["pending", "approved", "declined"]),
    requestedAt: requiredDate,
    decidedAt: date,
    reason: name,
  })
  .nullable()
  .optional()
  .default(null);

export const sellerAfterSaleSchema = z.object({
  stage: z.enum([...itemSubmissionStatuses, ...consignmentAfterSaleStages]),
  unsold: unsoldSchema
    .extend({ canChoose: z.boolean().default(false), choicePaused: z.boolean().default(false) })
    .nullable()
    .optional()
    .default(null),
  withdrawal: z.object({
    path: z.enum(["withdraw_now", "request", "requested", "unavailable"]),
    canAct: z.boolean().default(false),
    request: requestSchema,
  }),
}) as z.ZodType<SellerAfterSaleView>;

export const staffAfterSaleSchema = z.object({
  unsold: unsoldSchema.nullable().optional().default(null),
  withdrawal: requestSchema,
}) as z.ZodType<StaffAfterSaleView>;

export const consignmentMoveOptionsSchema = z.object({
  movable: z.boolean(),
  reason: name,
  options: z.array(
    z.object({ legalEntityId: z.string(), displayName: z.string(), role: z.string() }),
  ),
  agreementEffect: z.enum(["none", "carried", "reset"]),
}) as z.ZodType<ConsignmentMoveOptions>;

const reminderSchema = z.object({ lastSentAt: date, nextAllowedAt: date });

function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T | null {
  if (raw == null) return null;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseIdentityReminderState(raw: unknown): SellerIdentityReminderState | null {
  return parseWith(reminderSchema, raw);
}
