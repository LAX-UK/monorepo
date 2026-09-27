import type { Database } from "@auction/db";
import { crmRecordLink } from "@auction/db/schema";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import type {
  CrmRecordLinkRow,
  ICrmRecordLinkRepository,
  MergeCrmSubjectLinksResult,
  UpsertCrmRecordLinkInput,
} from "../interfaces/crm-record-link.repository.js";

function isRealZohoLink(zohoModule: string, zohoRecordId: string): boolean {
  return (
    zohoModule !== "__tombstone__" && zohoModule !== "__pending__" && zohoRecordId !== "__none__"
  );
}

function mapRow(row: typeof crmRecordLink.$inferSelect): CrmRecordLinkRow {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    zohoModule: row.zohoModule,
    zohoRecordId: row.zohoRecordId,
    subjectId: row.subjectId,
    erasedAt: row.erasedAt,
    deletionRequestedAt: row.deletionRequestedAt,
    recyclePurgedAt: row.recyclePurgedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleCrmRecordLinkRepository implements ICrmRecordLinkRepository {
  constructor(private readonly db: Database) {}

  async findByEntity(entityType: string, entityId: string): Promise<CrmRecordLinkRow | null> {
    const [row] = await this.db
      .select()
      .from(crmRecordLink)
      .where(and(eq(crmRecordLink.entityType, entityType), eq(crmRecordLink.entityId, entityId)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async upsertLink(input: UpsertCrmRecordLinkInput): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .insert(crmRecordLink)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        zohoModule: input.zohoModule,
        zohoRecordId: input.zohoRecordId,
        subjectId: input.subjectId ?? null,
        erasedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [crmRecordLink.entityType, crmRecordLink.entityId],
        set: {
          zohoModule: input.zohoModule,
          zohoRecordId: input.zohoRecordId,
          ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
          erasedAt: null,
          updatedAt: now,
        },
      });
  }

  async mergeSubjectLinks(input: {
    canonicalSubjectId: string;
    retiredSubjectId: string;
    tombstoneModule: string;
    tombstoneRecordId: string;
    now?: Date;
  }): Promise<MergeCrmSubjectLinksResult> {
    const now = input.now ?? new Date();
    return this.db.transaction(async (tx) => {
      const repo = new DrizzleCrmRecordLinkRepository(tx as unknown as Database);
      const canonical = await repo.findByEntity("subject", input.canonicalSubjectId);
      const retired = await repo.findByEntity("subject", input.retiredSubjectId);
      if (!retired || retired.erasedAt) {
        await repo.reassignDealLinksSubjectId(
          input.retiredSubjectId,
          input.canonicalSubjectId,
          now,
        );
        return {};
      }
      if (!isRealZohoLink(retired.zohoModule, retired.zohoRecordId)) {
        await repo.reassignDealLinksSubjectId(
          input.retiredSubjectId,
          input.canonicalSubjectId,
          now,
        );
        return {};
      }
      if (!canonical || canonical.erasedAt) {
        await repo.upsertLink({
          entityType: "subject",
          entityId: input.canonicalSubjectId,
          zohoModule: retired.zohoModule,
          zohoRecordId: retired.zohoRecordId,
          now,
        });
        await repo.reassignDealLinksSubjectId(
          input.retiredSubjectId,
          input.canonicalSubjectId,
          now,
        );
        await repo.tombstone({
          entityType: "subject",
          entityId: input.retiredSubjectId,
          tombstoneModule: input.tombstoneModule,
          tombstoneRecordId: input.tombstoneRecordId,
          now,
        });
        return {};
      }
      await repo.reassignDealLinksSubjectId(input.retiredSubjectId, input.canonicalSubjectId, now);
      await repo.tombstone({
        entityType: "subject",
        entityId: input.retiredSubjectId,
        tombstoneModule: input.tombstoneModule,
        tombstoneRecordId: input.tombstoneRecordId,
        now,
      });
      return {
        duplicateZohoModule: retired.zohoModule,
        duplicateZohoRecordId: retired.zohoRecordId,
      };
    });
  }

  async markErased(entityType: string, entityId: string, now?: Date): Promise<void> {
    const at = now ?? new Date();
    await this.db
      .update(crmRecordLink)
      .set({ erasedAt: at, updatedAt: at })
      .where(and(eq(crmRecordLink.entityType, entityType), eq(crmRecordLink.entityId, entityId)));
  }

  async tombstone(input: {
    entityType: string;
    entityId: string;
    tombstoneModule: string;
    tombstoneRecordId: string;
    now?: Date;
  }): Promise<void> {
    const at = input.now ?? new Date();
    await this.db
      .insert(crmRecordLink)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        zohoModule: input.tombstoneModule,
        zohoRecordId: input.tombstoneRecordId,
        erasedAt: at,
        createdAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [crmRecordLink.entityType, crmRecordLink.entityId],
        set: {
          erasedAt: at,
          updatedAt: at,
        },
      });
  }

  async tombstoneDealByZohoRecordId(zohoRecordId: string, now?: Date): Promise<void> {
    const at = now ?? new Date();
    await this.db
      .update(crmRecordLink)
      .set({ erasedAt: at, updatedAt: at })
      .where(
        and(
          eq(crmRecordLink.entityType, "deal"),
          eq(crmRecordLink.zohoRecordId, zohoRecordId),
          isNull(crmRecordLink.erasedAt),
        ),
      );
  }

  async setDeletionRequested(entityType: string, entityId: string, now?: Date): Promise<void> {
    const at = now ?? new Date();
    await this.db
      .insert(crmRecordLink)
      .values({
        entityType,
        entityId,
        zohoModule: "__pending__",
        zohoRecordId: "__none__",
        deletionRequestedAt: at,
        createdAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [crmRecordLink.entityType, crmRecordLink.entityId],
        set: { deletionRequestedAt: at, updatedAt: at },
      });
  }

  async clearDeletionRequested(entityType: string, entityId: string, now?: Date): Promise<void> {
    const at = now ?? new Date();
    await this.db
      .update(crmRecordLink)
      .set({ deletionRequestedAt: null, updatedAt: at })
      .where(and(eq(crmRecordLink.entityType, entityType), eq(crmRecordLink.entityId, entityId)));
  }

  async isDeletionRequested(entityType: string, entityId: string): Promise<boolean> {
    const row = await this.findByEntity(entityType, entityId);
    return row?.deletionRequestedAt != null;
  }

  async markRecyclePurged(entityType: string, entityId: string, now?: Date): Promise<void> {
    const at = now ?? new Date();
    await this.db
      .update(crmRecordLink)
      .set({ recyclePurgedAt: at, updatedAt: at })
      .where(and(eq(crmRecordLink.entityType, entityType), eq(crmRecordLink.entityId, entityId)));
  }

  async isErased(entityType: string, entityId: string): Promise<boolean> {
    const row = await this.findByEntity(entityType, entityId);
    return row?.erasedAt != null;
  }

  async reassignDealLinksSubjectId(
    fromSubjectId: string,
    toSubjectId: string,
    now?: Date,
  ): Promise<number> {
    const at = now ?? new Date();
    const updated = await this.db
      .update(crmRecordLink)
      .set({ subjectId: toSubjectId, updatedAt: at })
      .where(
        and(
          eq(crmRecordLink.entityType, "deal"),
          eq(crmRecordLink.subjectId, fromSubjectId),
          isNull(crmRecordLink.erasedAt),
        ),
      )
      .returning({ entityId: crmRecordLink.entityId });
    return updated.length;
  }

  async listActiveDealLinksBySubject(subjectId: string): Promise<CrmRecordLinkRow[]> {
    const rows = await this.db
      .select()
      .from(crmRecordLink)
      .where(
        and(
          eq(crmRecordLink.entityType, "deal"),
          eq(crmRecordLink.subjectId, subjectId),
          isNull(crmRecordLink.erasedAt),
        ),
      );
    return rows.map(mapRow);
  }

  async listActiveByEntityType(
    entityType: string,
    limit: number,
    offset: number,
  ): Promise<CrmRecordLinkRow[]> {
    const rows = await this.db
      .select()
      .from(crmRecordLink)
      .where(and(eq(crmRecordLink.entityType, entityType), isNull(crmRecordLink.erasedAt)))
      .limit(limit)
      .offset(offset);
    return rows.map(mapRow);
  }

  async listErasedWithRealZohoLinks(
    entityType: string,
    limit: number,
    offset: number,
  ): Promise<CrmRecordLinkRow[]> {
    const rows = await this.db
      .select()
      .from(crmRecordLink)
      .where(
        and(
          eq(crmRecordLink.entityType, entityType),
          isNotNull(crmRecordLink.erasedAt),
          ne(crmRecordLink.zohoModule, "__tombstone__"),
          ne(crmRecordLink.zohoModule, "__pending__"),
          ne(crmRecordLink.zohoRecordId, "__none__"),
        ),
      )
      .limit(limit)
      .offset(offset);
    return rows.map(mapRow);
  }
}
