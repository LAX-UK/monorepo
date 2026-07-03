import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type EnsurePersonalLegalEntityInput = {
  userId: string;
  /** Used as the entity `display_name` (falls back to email when blank). */
  displayName: string;
  email: string;
};

export type EnsurePersonalLegalEntityResult = {
  legalEntityId: string;
  /** True when this call inserted the row (false when an existing personal entity was found). */
  created: boolean;
};

/** Idempotently provisions the per-user `individual` / `private_collector` legal entity
 * + owning `legal_entity_member` row for a freshly-created user.
 */
export interface IEnsurePersonalLegalEntityService {
  ensure(input: EnsurePersonalLegalEntityInput): Promise<EnsurePersonalLegalEntityResult>;
}

export class EnsurePersonalLegalEntityService implements IEnsurePersonalLegalEntityService {
  constructor(private readonly db: Database) {}

  async ensure(input: EnsurePersonalLegalEntityInput): Promise<EnsurePersonalLegalEntityResult> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: legalEntity.id })
        .from(legalEntity)
        .where(
          and(eq(legalEntity.createdByUserId, input.userId), eq(legalEntity.kind, "individual")),
        )
        .limit(1);
      const existingRow = existing[0];
      if (existingRow) {
        await this.ensureMembership(tx, existingRow.id, input.userId);
        return { legalEntityId: existingRow.id, created: false };
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
      await this.ensureMembership(tx, inserted.id, input.userId);
      return { legalEntityId: inserted.id, created: true };
    });
  }

  private async ensureMembership(
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
}
