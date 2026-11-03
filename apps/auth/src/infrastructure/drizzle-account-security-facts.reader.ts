import type { IdentityDatabase } from "@auction/identity-db";
import { account, user } from "@auction/identity-db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
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
  if (!row) return null;
  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, subjectId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    )
    .limit(1);
  return { twoFactorEnabled: row.twoFactorEnabled, hasPassword: credential !== undefined };
}
