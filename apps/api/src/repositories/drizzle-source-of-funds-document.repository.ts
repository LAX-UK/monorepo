import type { Database } from "@auction/db";
import { sourceOfFundsDocument, uploadObject } from "@auction/db/schema";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { SourceOfFundsDocumentRow } from "../services/source-of-funds/source-of-funds.types.js";

function rowToDocument(
  row: typeof sourceOfFundsDocument.$inferSelect,
  fileName?: string | null,
): SourceOfFundsDocumentRow {
  return {
    id: row.id,
    sourceOfFundsId: row.sourceOfFundsId,
    uploadObjectId: row.uploadObjectId,
    requestedType: row.requestedType,
    label: row.label ?? null,
    reviewStatus: row.reviewStatus,
    retentionClass: row.retentionClass,
    uploadedByUserId: row.uploadedByUserId,
    uploadedAt: row.uploadedAt,
    supersededAt: row.supersededAt ?? null,
    anonymizedAt: row.anonymizedAt ?? null,
    fileName: fileName ?? null,
  };
}

export interface ISourceOfFundsDocumentRepository {
  attach(
    input: {
      sourceOfFundsId: string;
      uploadObjectId: string;
      requestedType: string;
      label: string | null;
      uploadedByUserId: string;
    },
    conn?: Database,
  ): Promise<SourceOfFundsDocumentRow>;
  supersedeActiveForType(
    sourceOfFundsId: string,
    requestedType: string,
    conn?: Database,
  ): Promise<string[]>;
  listForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentRow[]>;
  listActiveForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentRow[]>;
  findById(documentId: string, conn?: Database): Promise<SourceOfFundsDocumentRow | null>;
  countActiveForCase(sourceOfFundsId: string, conn?: Database): Promise<number>;
}

export class DrizzleSourceOfFundsDocumentRepository implements ISourceOfFundsDocumentRepository {
  constructor(private readonly db: Database) {}

  private conn(c?: Database): Database {
    return c ?? this.db;
  }

  async attach(
    input: {
      sourceOfFundsId: string;
      uploadObjectId: string;
      requestedType: string;
      label: string | null;
      uploadedByUserId: string;
    },
    conn?: Database,
  ): Promise<SourceOfFundsDocumentRow> {
    const [row] = await this.conn(conn)
      .insert(sourceOfFundsDocument)
      .values({
        sourceOfFundsId: input.sourceOfFundsId,
        uploadObjectId: input.uploadObjectId,
        requestedType: input.requestedType,
        label: input.label,
        uploadedByUserId: input.uploadedByUserId,
      })
      .returning();
    if (!row) throw new Error("source_of_funds_document_attach_failed");
    return rowToDocument(row);
  }

  async supersedeActiveForType(
    sourceOfFundsId: string,
    requestedType: string,
    conn?: Database,
  ): Promise<string[]> {
    const rows = await this.conn(conn)
      .select({ id: sourceOfFundsDocument.id })
      .from(sourceOfFundsDocument)
      .where(
        and(
          eq(sourceOfFundsDocument.sourceOfFundsId, sourceOfFundsId),
          eq(sourceOfFundsDocument.requestedType, requestedType),
          ne(sourceOfFundsDocument.reviewStatus, "superseded"),
          isNull(sourceOfFundsDocument.anonymizedAt),
        ),
      );
    if (rows.length === 0) return [];

    const now = new Date();
    await this.conn(conn)
      .update(sourceOfFundsDocument)
      .set({ reviewStatus: "superseded", supersededAt: now })
      .where(
        and(
          eq(sourceOfFundsDocument.sourceOfFundsId, sourceOfFundsId),
          eq(sourceOfFundsDocument.requestedType, requestedType),
          ne(sourceOfFundsDocument.reviewStatus, "superseded"),
          isNull(sourceOfFundsDocument.anonymizedAt),
        ),
      );
    return rows.map((row) => row.id);
  }

  async listForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentRow[]> {
    const rows = await this.conn(conn)
      .select({
        doc: sourceOfFundsDocument,
        key: uploadObject.key,
      })
      .from(sourceOfFundsDocument)
      .innerJoin(uploadObject, eq(uploadObject.id, sourceOfFundsDocument.uploadObjectId))
      .where(
        and(
          eq(sourceOfFundsDocument.sourceOfFundsId, sourceOfFundsId),
          isNull(sourceOfFundsDocument.anonymizedAt),
        ),
      )
      .orderBy(desc(sourceOfFundsDocument.uploadedAt));
    return rows.map((r) => rowToDocument(r.doc, r.key.split("/").pop() ?? r.key));
  }

  async listActiveForCase(
    sourceOfFundsId: string,
    conn?: Database,
  ): Promise<SourceOfFundsDocumentRow[]> {
    const rows = await this.listForCase(sourceOfFundsId, conn);
    return rows.filter((r) => r.reviewStatus !== "superseded");
  }

  async findById(documentId: string, conn?: Database): Promise<SourceOfFundsDocumentRow | null> {
    const [row] = await this.conn(conn)
      .select({
        doc: sourceOfFundsDocument,
        key: uploadObject.key,
      })
      .from(sourceOfFundsDocument)
      .innerJoin(uploadObject, eq(uploadObject.id, sourceOfFundsDocument.uploadObjectId))
      .where(
        and(eq(sourceOfFundsDocument.id, documentId), isNull(sourceOfFundsDocument.anonymizedAt)),
      )
      .limit(1);
    return row ? rowToDocument(row.doc, row.key.split("/").pop() ?? row.key) : null;
  }

  async countActiveForCase(sourceOfFundsId: string, conn?: Database): Promise<number> {
    const active = await this.listActiveForCase(sourceOfFundsId, conn);
    return active.length;
  }
}
