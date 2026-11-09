import type { IdentityDatabase } from "@auction/identity-db";
import { passkey } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";

/** Records that a passkey was just used to sign in; the person sees it as "last used". */
export function createPasskeyUsageRecorder(db: IdentityDatabase) {
  return {
    async markUsed(credentialId: string): Promise<void> {
      await db
        .update(passkey)
        .set({ lastUsedAt: new Date() })
        .where(eq(passkey.credentialId, credentialId));
    },
  };
}
