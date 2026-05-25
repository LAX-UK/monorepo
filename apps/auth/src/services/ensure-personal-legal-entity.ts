import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type EnsurePersonalLegalEntityInput = {
  userId: string;
  displayName: string;
  email: string;
};

/** Idempotently provisions the per-user individual legal entity for new auth users. */
export async function ensurePersonalLegalEntity(
  db: Database,
  input: EnsurePersonalLegalEntityInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: legalEntity.id })
      .from(legalEntity)
      .where(and(eq(legalEntity.createdByUserId, input.userId), eq(legalEntity.kind, "individual")))
      .limit(1);
    const existingRow = existing[0];
    if (existingRow) {
      await ensureMembership(tx, existingRow.id, input.userId);
      return;
    }

    const display = input.displayName.trim().length > 0 ? input.displayName.trim() : input.email;
    const [inserted] = await tx
      .insert(legalEntity)
      .values({
        displayName: display,
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: input.userId,
        status: "lead",
        statusChangedAt: new Date(),
      })
      .returning({ id: legalEntity.id });
    if (!inserted) {
      throw new Error("ensure_personal_legal_entity_insert_failed");
    }
    await ensureMembership(tx, inserted.id, input.userId);
  });
}

async function ensureMembership(
  tx: Database,
  legalEntityId: string,
  userId: string,
): Promise<void> {
  const existing = await tx
    .select({ id: legalEntityMember.id })
    .from(legalEntityMember)
    .where(
      and(
        eq(legalEntityMember.legalEntityId, legalEntityId),
        eq(legalEntityMember.userId, userId),
        isNull(legalEntityMember.removedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return;
  await tx.insert(legalEntityMember).values({
    legalEntityId,
    userId,
    role: "owner",
    isPrimaryAdmin: true,
    acceptedAt: new Date(),
  });
}
