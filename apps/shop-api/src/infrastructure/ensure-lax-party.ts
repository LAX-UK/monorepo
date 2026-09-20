import type { Database } from "@auction/db";
import { shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";

export const LAX_SHOP_PARTY_DISPLAY_NAME = "LAX London Art Exchange";

export async function ensureLaxShopParty(db: Database): Promise<string> {
  const existing = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.displayName, LAX_SHOP_PARTY_DISPLAY_NAME))
    .limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  const [created] = await db
    .insert(shopParty)
    .values({ displayName: LAX_SHOP_PARTY_DISPLAY_NAME })
    .returning({ id: shopParty.id });
  if (!created) {
    throw new Error("Failed to create LAX shop party");
  }
  return created.id;
}
