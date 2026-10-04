import { readFileSync } from "node:fs";
import { z } from "zod";

const fixturesSchema = z.object({
  ok: z.literal(true),
  adminStaffSubjectId: z.string(),
  consignorPartyId: z.string(),
  buyerPartyId: z.string(),
  holdEditionId: z.string(),
  holdArtworkId: z.string(),
  originalArtworkId: z.string(),
  merchandiseVariantId: z.string(),
  paidOrderId: z.string(),
  paidOrderLineId: z.string(),
  paidOrderEditionId: z.string(),
  paidOrderFulfilmentId: z.string(),
  paidOrderPayoutId: z.string(),
});

export type StaffOperationsFixtures = z.infer<typeof fixturesSchema>;

export function loadStaffOperationsFixtures(): StaffOperationsFixtures {
  const path = process.env.SHOP_ACCEPTANCE_FIXTURES_PATH?.trim();
  if (!path) {
    throw new Error("SHOP_ACCEPTANCE_FIXTURES_PATH is required for staff operations e2e");
  }
  return fixturesSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
