import { z } from "zod";

const rfc3339Timestamp = z.string().datetime({ offset: true });

export const shopOrderPaidPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string().uuid(),
  identitySubjectId: z.string(),
  totalPence: z.number().int().nonnegative(),
  paidAt: rfc3339Timestamp,
  lineCount: z.number().int().nonnegative(),
});
