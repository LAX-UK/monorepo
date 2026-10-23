import type { IdentityDatabase } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import type { AccountSecurityBaseFacts } from "../services/account-security-facts.service.js";

export async function readAccountSecurityBaseFacts(
  db: IdentityDatabase,
  subjectId: string,
): Promise<AccountSecurityBaseFacts | null> {
  const [row] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, subjectId))
    .limit(1);
  return row ?? null;
}
