import type { Database } from "@auction/db";
import { shopUserProfile } from "@auction/db/schema";
import {
  userIdentityDisabledPayloadSchemaV1,
  userIdentityEnabledPayloadSchemaV1,
  userIdentityMergedPayloadSchemaV1,
  userProfileUpdatedPayloadSchemaV1,
} from "@auction/identity-contracts";
import { userRegisteredPayloadSchemaV1 } from "@auction/types";
import { eq, sql } from "drizzle-orm";

export class ShopIdentityProjectionService {
  constructor(private readonly db: Database) {}

  async apply(eventType: string, payload: unknown): Promise<void> {
    if (eventType === "user.registered") {
      const parsed = userRegisteredPayloadSchemaV1.parse(payload);
      await this.upsert({
        identitySubjectId: parsed.userId,
        email: parsed.email,
        name: parsed.name,
      });
      return;
    }
    if (eventType === "user.profile_updated") {
      const parsed = userProfileUpdatedPayloadSchemaV1.parse(payload);
      await this.upsert({
        identitySubjectId: parsed.subjectId,
        email: parsed.email,
        name: parsed.name,
      });
      return;
    }
    if (eventType === "user.identity_merged") {
      const parsed = userIdentityMergedPayloadSchemaV1.parse(payload);
      await this.db.transaction(async (tx) => {
        const retired = await tx.query.shopUserProfile.findFirst({
          where: eq(shopUserProfile.identitySubjectId, parsed.retiredSubjectId),
        });
        if (!retired) return;
        const now = new Date(parsed.mergedAt);
        await tx
          .insert(shopUserProfile)
          .values({
            identitySubjectId: parsed.subjectId,
            email: retired.email,
            name: retired.name,
            disabledAt: null,
            mergedIntoSubjectId: null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
        await tx
          .update(shopUserProfile)
          .set({
            disabledAt: now,
            mergedIntoSubjectId: parsed.subjectId,
            updatedAt: now,
          })
          .where(eq(shopUserProfile.identitySubjectId, parsed.retiredSubjectId));
      });
      return;
    }
    if (eventType === "user.identity_disabled") {
      const parsed = userIdentityDisabledPayloadSchemaV1.parse(payload);
      await this.db
        .update(shopUserProfile)
        .set({ disabledAt: new Date(parsed.disabledAt), updatedAt: new Date() })
        .where(eq(shopUserProfile.identitySubjectId, parsed.subjectId));
      return;
    }
    if (eventType === "user.identity_enabled") {
      const parsed = userIdentityEnabledPayloadSchemaV1.parse(payload);
      await this.db
        .update(shopUserProfile)
        .set({ disabledAt: null, updatedAt: new Date() })
        .where(eq(shopUserProfile.identitySubjectId, parsed.subjectId));
      return;
    }
  }

  private async upsert(input: {
    identitySubjectId: string;
    email?: string | undefined;
    name?: string | undefined;
  }): Promise<void> {
    await this.db
      .insert(shopUserProfile)
      .values({
        identitySubjectId: input.identitySubjectId,
        email: input.email ?? null,
        name: input.name ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: shopUserProfile.identitySubjectId,
        set: {
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          updatedAt: sql`now()`,
        },
      });
  }
}
