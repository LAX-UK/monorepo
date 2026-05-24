import type { Database } from "@auction/db";
import { lotDocument, uploadObject } from "@auction/db/schema";
import type { LotDocumentKind } from "@auction/types";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { EntityDocumentPersistedRow } from "../lib/entity-document-presenter.js";
import type { ILotDocumentRepository } from "../services/interfaces/repositories.js";

function mapRow(
  entityId: string,
  r: {
    id: string;
    kind: string;
    label: string | null;
    uploadObjectId: string;
    key: string;
    actualByteSize: number | null;
    actualContentType: string | null;
    createdAt: Date;
  },
): EntityDocumentPersistedRow {
  return {
    id: r.id,
    entityId,
    kind: r.kind,
    label: r.label,
    uploadObjectId: r.uploadObjectId,
    key: r.key,
    actualByteSize: r.actualByteSize,
    actualContentType: r.actualContentType,
    createdByUserId: null,
    createdAt: r.createdAt,
  };
}

export class DrizzleLotDocumentRepository implements ILotDocumentRepository {
  constructor(private readonly db: Database) {}

  async attach(input: {
    entityId: string;
    kind: LotDocumentKind;
    label: string | null;
    uploadObjectId: string;
    createdByUserId: string;
  }): Promise<EntityDocumentPersistedRow> {
    const [ins] = await this.db
      .insert(lotDocument)
      .values({
        lotId: input.entityId,
        kind: input.kind,
        label: input.label,
        uploadObjectId: input.uploadObjectId,
      })
      .returning({
        id: lotDocument.id,
        kind: lotDocument.kind,
        label: lotDocument.label,
        uploadObjectId: lotDocument.uploadObjectId,
        createdAt: lotDocument.createdAt,
      });
    if (!ins) throw new Error("lot_document_insert_failed");
    const [u] = await this.db
      .select({
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(uploadObject)
      .where(eq(uploadObject.id, ins.uploadObjectId))
      .limit(1);
    if (!u) throw new Error("upload_object_missing_after_lot_document_insert");
    return mapRow(input.entityId, { ...ins, ...u });
  }

  async remove(entityId: string, documentId: string): Promise<void> {
    await this.db
      .delete(lotDocument)
      .where(and(eq(lotDocument.id, documentId), eq(lotDocument.lotId, entityId)));
  }

  async listRowsForEntity(entityId: string): Promise<EntityDocumentPersistedRow[]> {
    const rows = await this.db
      .select({
        id: lotDocument.id,
        kind: lotDocument.kind,
        label: lotDocument.label,
        uploadObjectId: lotDocument.uploadObjectId,
        createdAt: lotDocument.createdAt,
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(lotDocument)
      .innerJoin(uploadObject, eq(lotDocument.uploadObjectId, uploadObject.id))
      .where(
        and(
          eq(lotDocument.lotId, entityId),
          eq(uploadObject.status, "active"),
          isNull(lotDocument.deletedAt),
        ),
      )
      .orderBy(asc(lotDocument.createdAt));
    return rows.map((r) => mapRow(entityId, r));
  }

  async listRowsForEntityIds(
    entityIds: string[],
  ): Promise<Map<string, EntityDocumentPersistedRow[]>> {
    const map = new Map<string, EntityDocumentPersistedRow[]>();
    for (const id of entityIds) map.set(id, []);
    if (entityIds.length === 0) return map;

    const rows = await this.db
      .select({
        entityId: lotDocument.lotId,
        id: lotDocument.id,
        kind: lotDocument.kind,
        label: lotDocument.label,
        uploadObjectId: lotDocument.uploadObjectId,
        createdAt: lotDocument.createdAt,
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(lotDocument)
      .innerJoin(uploadObject, eq(lotDocument.uploadObjectId, uploadObject.id))
      .where(
        and(
          inArray(lotDocument.lotId, entityIds),
          eq(uploadObject.status, "active"),
          isNull(lotDocument.deletedAt),
        ),
      )
      .orderBy(asc(lotDocument.createdAt));

    for (const r of rows) {
      const list = map.get(r.entityId);
      if (list) {
        const { entityId, ...rest } = r;
        list.push(mapRow(entityId, rest));
      }
    }
    return map;
  }
}
