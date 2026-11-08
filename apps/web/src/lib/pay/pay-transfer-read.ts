import type { BankTransferInstructions } from "@auction/types";
import { z } from "zod";

const instructionsSchema = z.object({
  accountName: z.string().min(1),
  sortCode: z.string().min(1),
  accountNumber: z.string().min(1),
  reference: z.string().min(1),
}) satisfies z.ZodType<BankTransferInstructions, z.ZodTypeDef, unknown>;

const responseSchema = z.object({
  data: z.object({ instructions: instructionsSchema.nullable() }),
});

/**
 * The bank details from the API's answer, or `null` when there are none to show: no transfer is
 * waiting, the request failed, or what came back is not details. The page then says where else
 * to find them; it never invents them.
 */
export function readPayTransferResponse(
  status: number,
  body: unknown,
): BankTransferInstructions | null {
  if (status < 200 || status >= 300) return null;
  const parsed = responseSchema.safeParse(body);
  return parsed.success ? parsed.data.data.instructions : null;
}
