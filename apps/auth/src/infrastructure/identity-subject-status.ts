import type { IdentityDatabase } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";

/** True while the identity exists and is neither disabled nor merged into another one. */
export async function isIdentitySubjectActive(
  db: IdentityDatabase,
  subject: string,
): Promise<boolean> {
  const [identity] = await db
    .select({
      id: user.id,
      disabledAt: user.identityDisabledAt,
      mergedInto: user.mergedIntoSubjectId,
    })
    .from(user)
    .where(eq(user.id, subject))
    .limit(1);
  return Boolean(identity && !identity.disabledAt && !identity.mergedInto);
}
