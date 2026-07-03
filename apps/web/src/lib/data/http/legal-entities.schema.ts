import { toObjectRecord } from "@/lib/data/http/object-guards";
import type { LegalEntityMemberRole, LegalEntityStatus, LegalEntitySummary } from "@auction/types";
import { z } from "zod";

export const legalEntitySummarySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): LegalEntitySummary => ({
      id: String(row.id ?? ""),
      displayName: String(row.displayName ?? ""),
      kind: row.kind as LegalEntitySummary["kind"],
      subkind: row.subkind as LegalEntitySummary["subkind"],
      status: row.status as LegalEntityStatus,
      role: row.role as LegalEntityMemberRole,
      isPrimaryAdmin: Boolean(row.isPrimaryAdmin),
      ...(row.isImpersonation === true ? { isImpersonation: true as const } : {}),
    }),
  ) as z.ZodType<LegalEntitySummary>;
