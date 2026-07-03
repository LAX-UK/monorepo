import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import { documentEntityKinds } from "@auction/types";
import { z } from "zod";

export const entityDocumentSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): EntityDocument => {
    const rawKind = row.entityKind;
    const entityKind =
      typeof rawKind === "string" && (documentEntityKinds as readonly string[]).includes(rawKind)
        ? (rawKind as DocumentEntityKind)
        : "submission";
    return {
      id: String(row.id ?? ""),
      entityKind,
      entityId: String(row.entityId ?? ""),
      kind: String(row.kind ?? ""),
      label: row.label == null ? null : String(row.label),
      uploadObjectId: String(row.uploadObjectId ?? ""),
      downloadUrl: String(row.downloadUrl ?? ""),
      fileName: row.fileName == null ? null : String(row.fileName),
      byteSize: row.byteSize == null ? null : Number(row.byteSize),
      contentType: row.contentType == null ? null : String(row.contentType),
      createdByUserId: row.createdByUserId == null ? null : String(row.createdByUserId),
      createdAt: zCoerceDate.parse(row.createdAt),
    };
  }) as z.ZodType<EntityDocument>;
