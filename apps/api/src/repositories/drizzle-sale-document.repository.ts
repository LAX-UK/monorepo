import type { Database } from "@auction/db";
import { saleDocument, uploadObject } from "@auction/db/schema";
import type { SaleDocumentKind } from "@auction/types";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { EntityDocumentPersistedRow } from "../lib/entity-document-presenter.js";
import type { ISaleDocumentRepository } from "../services/interfaces/repositories.js";

function mapRow(
  entityId: string,
  r: {
    id: string;
    kind: string;
    label: string | null;
    uploadObjectId: string;
    createdByUserId: string;
    createdAt: Date;
    key: string;
    actualByteSize: number | null;
    actualContentType: string | null;
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
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
  };
}

export class DrizzleSaleDocumentRepository implements ISaleDocumentRepository {
  constructor(private readonly db: Database) {}

  async attach(input: {
    entityId: string;
    kind: SaleDocumentKind;
    label: string | null;
    uploadObjectId: string;
    createdByUserId: string;
  }): Promise<EntityDocumentPersistedRow> {
    const [ins] = await this.db
      .insert(saleDocument)
      .values({
        saleId: input.entityId,
        kind: input.kind,
        label: input.label,
        uploadObjectId: input.uploadObjectId,
        createdByUserId: input.createdByUserId,
      })
      .returning({
        id: saleDocument.id,
        kind: saleDocument.kind,
        label: saleDocument.label,
        uploadObjectId: saleDocument.uploadObjectId,
        createdByUserId: saleDocument.createdByUserId,
        createdAt: saleDocument.createdAt,
      });
    if (!ins) throw new Error("sale_document_insert_failed");
    const [u] = await this.db
      .select({
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(uploadObject)
      .where(eq(uploadObject.id, ins.uploadObjectId))
      .limit(1);
    if (!u) throw new Error("upload_object_missing_after_sale_document_insert");
    return mapRow(input.entityId, { ...ins, ...u });
  }

  async remove(entityId: string, documentId: string): Promise<void> {
    await this.db
      .delete(saleDocument)
      .where(and(eq(saleDocument.id, documentId), eq(saleDocument.saleId, entityId)));
  }

  async listRowsForEntity(entityId: string): Promise<EntityDocumentPersistedRow[]> {
    const rows = await this.db
      .select({
        id: saleDocument.id,
        kind: saleDocument.kind,
        label: saleDocument.label,
        uploadObjectId: saleDocument.uploadObjectId,
        createdByUserId: saleDocument.createdByUserId,
        createdAt: saleDocument.createdAt,
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(saleDocument)
      .innerJoin(uploadObject, eq(saleDocument.uploadObjectId, uploadObject.id))
      .where(and(eq(saleDocument.saleId, entityId), eq(uploadObject.status, "active")))
      .orderBy(asc(saleDocument.createdAt));
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
        entityId: saleDocument.saleId,
        id: saleDocument.id,
        kind: saleDocument.kind,
        label: saleDocument.label,
        uploadObjectId: saleDocument.uploadObjectId,
        createdByUserId: saleDocument.createdByUserId,
        createdAt: saleDocument.createdAt,
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(saleDocument)
      .innerJoin(uploadObject, eq(saleDocument.uploadObjectId, uploadObject.id))
      .where(and(inArray(saleDocument.saleId, entityIds), eq(uploadObject.status, "active")))
      .orderBy(asc(saleDocument.createdAt));

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
