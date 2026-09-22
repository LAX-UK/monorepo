import type { Database } from "@auction/db";
import { shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { isPgUniqueViolation } from "../lib/pg-errors.js";

export { ensureLaxShopParty, LAX_SHOP_PARTY_DISPLAY_NAME } from "./ensure-lax-party.js";

export async function findOrCreateBuyerParty(
  tx: Database,
  subject: string,
  displayName: string,
): Promise<string> {
  const existing = await tx
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, subject))
    .limit(1);
  if (existing[0]) return existing[0].id;
  try {
    const [created] = await tx
      .insert(shopParty)
      .values({ displayName, identitySubjectId: subject })
      .returning({ id: shopParty.id });
    if (!created) throw new Error("Failed to create buyer party");
    return created.id;
  } catch (error) {
    if (!isPgUniqueViolation(error)) throw error;
    const [row] = await tx
      .select({ id: shopParty.id })
      .from(shopParty)
      .where(eq(shopParty.identitySubjectId, subject))
      .limit(1);
    if (!row) throw error;
    return row.id;
  }
}
