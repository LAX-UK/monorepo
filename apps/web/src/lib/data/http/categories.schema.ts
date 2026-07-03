import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import type { Category } from "@auction/types";
import { z } from "zod";

export const categoryRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): Category => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    archived: Boolean(row.archived ?? false),
    sortOrder: Number(row.sortOrder ?? 0),
    parentId: row.parentId == null ? null : String(row.parentId),
    heroImageKey:
      row.heroImageKey == null || row.heroImageKey === "" ? null : String(row.heroImageKey),
    createdAt: row.createdAt ? zCoerceDate.parse(row.createdAt) : new Date(),
    updatedAt: row.updatedAt ? zCoerceDate.parse(row.updatedAt) : new Date(),
  }),
) as z.ZodType<Category>;
