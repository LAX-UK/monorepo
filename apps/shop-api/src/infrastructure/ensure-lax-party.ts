import type { Database } from "@auction/db";
import { shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";

export const LAX_SHOP_PARTY_DISPLAY_NAME = "LAX London Art Exchange";

export async function ensureLaxShopParty(db: Database): Promise<string> {
  const byKind = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.kind, "lax"))
    .limit(1);
  if (byKind[0]) {
    return byKind[0].id;
  }
  const existing = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.displayName, LAX_SHOP_PARTY_DISPLAY_NAME))
    .limit(1);
  if (existing[0]) {
    await db.update(shopParty).set({ kind: "lax" }).where(eq(shopParty.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db
    .insert(shopParty)
    .values({ displayName: LAX_SHOP_PARTY_DISPLAY_NAME, kind: "lax" })
    .returning({ id: shopParty.id });
  if (!created) {
    throw new Error("Failed to create LAX shop party");
  }
  return created.id;
}
