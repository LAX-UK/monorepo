import type { Database } from "@auction/db";
import { shopUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";

export async function resolveShopUserEmail(
  db: Database,
  identitySubjectId: string,
): Promise<string | null> {
  const [profile] = await db
    .select({ email: shopUserProfile.email })
    .from(shopUserProfile)
    .where(eq(shopUserProfile.identitySubjectId, identitySubjectId))
    .limit(1);
  const email = profile?.email?.trim();
  return email?.includes("@") ? email : null;
}
