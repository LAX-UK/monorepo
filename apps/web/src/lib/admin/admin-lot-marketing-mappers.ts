import type { LotMarketingDetails } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { z } from "zod";

/** Wider than API schema: allows empty strings in the form before normalization. */
export const adminLotMarketingFormValuesSchema = z.object({
  sellerArtistId: z.string(),
  conditionReport: z.object({
    summary: z.string().max(5000),
    details: z.string().max(10_000),
    downloadUrl: z.string().max(2048),
  }),
  provenance: z.array(z.object({ period: z.string().max(120), note: z.string().max(500) })),
  exhibitions: z.array(
    z.object({
      year: z.string().max(20),
      venue: z.string().max(200),
      note: z.string().max(500),
    }),
  ),
  artistNote: z.string().max(5000),
});
export type AdminLotMarketingFormValues = z.infer<typeof adminLotMarketingFormValuesSchema>;

export function marketingDetailsToFormValues(md: LotMarketingDetails): AdminLotMarketingFormValues {
  return {
    sellerArtistId: md.sellerArtistId ?? "",
    conditionReport: {
      summary: md.conditionReport?.summary ?? "",
      details: md.conditionReport?.details ?? "",
      downloadUrl: md.conditionReport?.downloadUrl ?? "",
    },
    provenance:
      md.provenance?.map((p) => ({
        period: p.period ?? "",
        note: p.note,
      })) ?? [],
    exhibitions:
      md.exhibitions?.map((e) => ({
        year: e.year ?? "",
        venue: e.venue,
        note: e.note ?? "",
      })) ?? [],
    artistNote: md.artistNote ?? "",
  };
}

export function formValuesToApiPatch(
  values: AdminLotMarketingFormValues,
): UpdateLotMarketingDetailsInput {
  const c = values.conditionReport;
  const condHas = Boolean(c.summary.trim() || c.details.trim() || c.downloadUrl.trim());
  const provenance = values.provenance
    .map((p) => ({
      period: p.period.trim() || undefined,
      note: p.note.trim(),
    }))
    .filter((p) => p.note.length > 0);
  const exhibitions = values.exhibitions
    .map((e) => ({
      year: e.year.trim() || undefined,
      venue: e.venue.trim(),
      note: e.note.trim() || undefined,
    }))
    .filter((e) => e.venue.length > 0);
  return {
    sellerArtistId: values.sellerArtistId.trim() ? values.sellerArtistId.trim() : null,
    conditionReport: condHas
      ? {
          summary: c.summary.trim() || undefined,
          details: c.details.trim() || undefined,
          downloadUrl: c.downloadUrl.trim() || undefined,
        }
      : null,
    provenance: provenance.length > 0 ? provenance : null,
    exhibitions: exhibitions.length > 0 ? exhibitions : null,
    artistNote: values.artistNote.trim() ? values.artistNote.trim() : null,
  };
}
