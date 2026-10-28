import { unsoldLotChoiceKinds } from "@auction/types";
import { z } from "zod";

const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount, for example 4500");

/** An optional amount: empty means none. */
const optionalAmount = z
  .union([amount, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

/** The seller's choice for a lot that did not sell. */
export const unsoldLotChoiceRequestBodySchema = z.object({
  choice: z.enum(unsoldLotChoiceKinds),
  reserve: optionalAmount,
});

export type UnsoldLotChoiceRequestBody = z.infer<typeof unsoldLotChoiceRequestBodySchema>;

/** The specialist's confirmation, with a note when it differs from the request. */
export const unsoldLotChoiceDecisionBodySchema = z.object({
  choice: z.enum(unsoldLotChoiceKinds),
  reserve: optionalAmount,
  note: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1,000 characters")
    .optional()
    .transform((value) => (value ? value : null)),
});

export type UnsoldLotChoiceDecisionBody = z.infer<typeof unsoldLotChoiceDecisionBodySchema>;

/** The lowest reserve the specialist accepts for a relist; empty clears it. */
export const relistReserveFloorBodySchema = z.object({ floor: optionalAmount });

export type RelistReserveFloorBody = z.infer<typeof relistReserveFloorBodySchema>;

/** The organisation a personal consignment moves to. */
export const consignmentMoveBodySchema = z.object({
  legalEntityId: z.string().uuid("Choose an organisation"),
});

export type ConsignmentMoveBody = z.infer<typeof consignmentMoveBodySchema>;
