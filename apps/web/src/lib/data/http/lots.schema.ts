import type { ArchiveEndedSummary } from "@/lib/data/contracts";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { parseBid, parseLot, parseLotDetail } from "@/lib/data/http/parse";
import type { LotDocumentPublicRow } from "@/lib/data/lot-documents-public";
import type { Bid, Lot, PublicLotView } from "@auction/types";
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

export const bidEnvelopeSchema = z.unknown().transform((val) => parseBid(val)) as z.ZodType<Bid>;

export const lotEnvelopeSchema = z.unknown().transform((val) => parseLot(val)) as z.ZodType<Lot>;

export const publicLotViewEnvelopeSchema = z
  .unknown()
  .transform((val) => parseLotDetail(val)) as z.ZodType<Lot | PublicLotView>;
