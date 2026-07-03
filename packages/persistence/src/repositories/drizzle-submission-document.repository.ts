import type { Database } from "@auction/db";
import { submissionDocument, uploadObject } from "@auction/db/schema";
import type { SubmissionDocumentKind } from "@auction/types";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { ISubmissionDocumentRepository } from "../interfaces/entity-document.repository.js";
import type { EntityDocumentPersistedRow } from "../lib/entity-document.types.js";

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

export class DrizzleSubmissionDocumentRepository implements ISubmissionDocumentRepository {
  constructor(private readonly db: Database) {}

  async attach(input: {
    entityId: string;
    kind: SubmissionDocumentKind;
    label: string | null;
    uploadObjectId: string;
    createdByUserId: string;
  }): Promise<EntityDocumentPersistedRow> {
    const [ins] = await this.db
      .insert(submissionDocument)
      .values({
        submissionId: input.entityId,
        kind: input.kind,
        label: input.label,
        uploadObjectId: input.uploadObjectId,
        createdByUserId: input.createdByUserId,
      })
      .returning({
        id: submissionDocument.id,
        kind: submissionDocument.kind,
        label: submissionDocument.label,
        uploadObjectId: submissionDocument.uploadObjectId,
        createdByUserId: submissionDocument.createdByUserId,
        createdAt: submissionDocument.createdAt,
      });
    if (!ins) throw new Error("submission_document_insert_failed");
    const [u] = await this.db
      .select({
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(uploadObject)
      .where(eq(uploadObject.id, ins.uploadObjectId))
      .limit(1);
    if (!u) throw new Error("upload_object_missing_after_submission_document_insert");
    return mapRow(input.entityId, { ...ins, ...u });
  }

  async remove(entityId: string, documentId: string): Promise<void> {
    await this.db
      .delete(submissionDocument)
      .where(
        and(eq(submissionDocument.id, documentId), eq(submissionDocument.submissionId, entityId)),
      );
  }

  async listRowsForEntity(entityId: string): Promise<EntityDocumentPersistedRow[]> {
    const rows = await this.db
      .select({
        id: submissionDocument.id,
        kind: submissionDocument.kind,
        label: submissionDocument.label,
        uploadObjectId: submissionDocument.uploadObjectId,
        createdByUserId: submissionDocument.createdByUserId,
        createdAt: submissionDocument.createdAt,
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(submissionDocument)
      .innerJoin(uploadObject, eq(submissionDocument.uploadObjectId, uploadObject.id))
      .where(and(eq(submissionDocument.submissionId, entityId), eq(uploadObject.status, "active")))
      .orderBy(asc(submissionDocument.createdAt));
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
        entityId: submissionDocument.submissionId,
        id: submissionDocument.id,
        kind: submissionDocument.kind,
        label: submissionDocument.label,
        uploadObjectId: submissionDocument.uploadObjectId,
        createdByUserId: submissionDocument.createdByUserId,
        createdAt: submissionDocument.createdAt,
        key: uploadObject.key,
        actualByteSize: uploadObject.actualByteSize,
        actualContentType: uploadObject.actualContentType,
      })
      .from(submissionDocument)
      .innerJoin(uploadObject, eq(submissionDocument.uploadObjectId, uploadObject.id))
      .where(
        and(inArray(submissionDocument.submissionId, entityIds), eq(uploadObject.status, "active")),
      )
      .orderBy(asc(submissionDocument.createdAt));

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
