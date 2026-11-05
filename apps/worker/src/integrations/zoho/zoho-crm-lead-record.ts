import { z } from "zod";
import type { CrmLeadSummary } from "../crm/crm-gateway.js";

const idRef = z.object({ id: z.string().min(1) }).passthrough();

const leadRecordSchema = z.object({
  data: z
    .array(
      z
        .object({
          Lead_Status: z.string().nullish(),
          Owner: idRef.nullish(),
          Converted_Detail: z.object({ contact: idRef.nullish() }).passthrough().nullish(),
        })
        .passthrough(),
    )
    .optional(),
});

/** Reads the owner and the converted Contact out of a `GET /Leads/{id}` response. */
export function parseLeadRecord(bodyText: string): CrmLeadSummary | null {
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return null;
  }
  const parsed = leadRecordSchema.safeParse(json);
  const row = parsed.success ? parsed.data.data?.[0] : undefined;
  if (!row) return null;
  return {
    status: row.Lead_Status ?? null,
    ownerId: row.Owner?.id ?? null,
    convertedContactId: row.Converted_Detail?.contact?.id ?? null,
  };
}
