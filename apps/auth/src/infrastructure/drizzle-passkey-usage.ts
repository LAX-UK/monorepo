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

/** Reads a passkey's stored signature counter, so a counter that goes backwards can be reported. */
export function createPasskeyCounterReader(db: IdentityDatabase) {
  return {
    async findByCredentialId(
      credentialId: string,
    ): Promise<{ id: string; userId: string; counter: number } | null> {
      const [row] = await db
        .select({ id: passkey.id, userId: passkey.userId, counter: passkey.counter })
        .from(passkey)
        .where(eq(passkey.credentialId, credentialId))
        .limit(1);
      return row ?? null;
    },
  };
}
