import type { ArchiveEndedSummary } from "@/lib/data/contracts";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { parseBid, parseLot, parseLotDetail } from "@/lib/data/http/parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";
import type { LotDocumentPublicRow } from "@/lib/data/lot-documents-public";
import { z } from "zod";

export const lotDocumentPublicRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): LotDocumentPublicRow => ({
      id: String(row.id ?? ""),
      kind: String(row.kind ?? ""),
      label: row.label == null ? null : String(row.label),
      downloadUrl: String(row.downloadUrl ?? ""),
    }),
  ) as z.ZodType<LotDocumentPublicRow>;

export const archiveEndedSummarySchema = z
  .object({
    totalHammer: z.coerce.string(),
    endedLotCount: z.coerce.number(),
  })
  .transform((data): ArchiveEndedSummary => data) as z.ZodType<ArchiveEndedSummary>;

export const lotCountBodySchema = z.object({ count: z.coerce.number().optional() });

export const watchCountSchema = z.object({ count: z.coerce.number().optional() });

/** Row schema for parse* envelope helpers (bid, lot, etc.). Uses zTransformParse. */
export const bidEnvelopeSchema = zTransformParse(parseBid);
export const lotEnvelopeSchema = zTransformParse(parseLot);
export const publicLotViewEnvelopeSchema = zTransformParse(parseLotDetail);
