import { lotSchema } from "@/lib/data/http/lot.schema";
import { isWithdrawnLotRow, toObjectRecord } from "@/lib/data/http/object-guards";
import { saleSchema } from "@/lib/data/http/sale.schema";
import { parseSaleListRowApiPayload } from "@/lib/sale-list-row";
import type { SaleListRow } from "@/lib/sale-list-row";
import type { SaleResultsSummary } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { z } from "zod";

export type SaleViewerState = {
  isFollowing: boolean;
};

export type SaleWithLots = { sale: Sale; lots: Lot[]; viewer?: SaleViewerState };

export type SaleShell = {
  sale: Sale;
  viewer?: SaleViewerState;
  /** Server-computed results of an ended sale; null while the sale has none yet. */
  resultsSummary: SaleResultsSummary | null;
};

/** What the catalogue shows of a withdrawn lot: its number and title, nothing else. */
export type WithdrawnCatalogueRow = { id: string; lotNumber: number | null; title: string };

export type SaleLotsPage = {
  items: Lot[];
  /** Withdrawn lots on the page, kept for the catalogue's numbering. Not part of `items`. */
  withdrawn: WithdrawnCatalogueRow[];
  total: number;
  limit: number;
  offset: number;
  sort: "lot" | "priceAsc" | "priceDesc" | "endingAsc";
};

export type SaleRegistrationMineRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: string;
  bidLimit: string | null;
  rejectionReason: string | null;
  paddleNumber: number | null;
  checkedInAt: string | null;
};

export type SitemapSale = { id: string; title: string };

const saleRegistrationStatuses = ["pending", "approved", "rejected", "withdrawn"] as const;

export const saleRegistrationMineRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): SaleRegistrationMineRow => {
    const st = row.status;
    const status =
      typeof st === "string" && (saleRegistrationStatuses as readonly string[]).includes(st)
        ? (st as SaleRegistrationMineRow["status"])
        : "pending";
    return {
      id: String(row.id ?? ""),
      saleId: String(row.saleId ?? ""),
      userId: String(row.userId ?? ""),
      buyerLegalEntityId: String(row.buyerLegalEntityId ?? ""),
      status,
      requestedAt: typeof row.requestedAt === "string" ? row.requestedAt : "",
      bidLimit: row.bidLimit == null ? null : String(row.bidLimit),
      rejectionReason: row.rejectionReason == null ? null : String(row.rejectionReason),
      paddleNumber:
        typeof row.paddleNumber === "number" && Number.isInteger(row.paddleNumber)
          ? row.paddleNumber
          : null,
      checkedInAt: typeof row.checkedInAt === "string" ? row.checkedInAt : null,
    };
  }) as z.ZodType<SaleRegistrationMineRow>;

const viewerStateSchema = z
  .object({ isFollowing: z.unknown().optional() })
  .transform((v): SaleViewerState => ({ isFollowing: Boolean(v.isFollowing) }));

const resultsSummarySchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("finalising"), pendingLotCount: z.coerce.number() }),
  z.object({
    state: z.literal("final"),
    lotCount: z.coerce.number(),
    soldCount: z.coerce.number(),
    currency: z.string(),
    totalWithPremium: z.string(),
    topLot: z.object({ lotId: z.string(), priceWithPremium: z.string() }).nullable(),
    endedAt: z.string(),
  }),
]);

export const saleShellDataSchema = z
  .object({
    sale: z.unknown(),
    viewer: viewerStateSchema.optional(),
    resultsSummary: z.unknown().optional(),
  })
  .transform((data): SaleShell => {
    const sale = saleSchema.parse(data.sale);
    const parsed = resultsSummarySchema.safeParse(data.resultsSummary);
    const resultsSummary = parsed.success ? parsed.data : null;
    return data.viewer ? { sale, viewer: data.viewer, resultsSummary } : { sale, resultsSummary };
  }) as z.ZodType<SaleShell>;

function toWithdrawnRow(value: unknown): WithdrawnCatalogueRow | null {
  const row = toObjectRecord(value);
  if (typeof row.id !== "string" || typeof row.title !== "string") return null;
  return {
    id: row.id,
    title: row.title,
    lotNumber: typeof row.lotNumber === "number" ? row.lotNumber : null,
  };
}

export const saleWithLotsDataSchema = z
  .object({
    sale: z.unknown(),
    lots: z.array(z.unknown()),
    viewer: viewerStateSchema.optional(),
  })
  .transform((data): SaleWithLots => {
    const base = {
      sale: saleSchema.parse(data.sale),
      lots: data.lots.filter((lot) => !isWithdrawnLotRow(lot)).map((lot) => lotSchema.parse(lot)),
    };
    return data.viewer ? { ...base, viewer: data.viewer } : base;
  }) as z.ZodType<SaleWithLots>;

const saleLotsSortSchema = z.enum(["lot", "priceAsc", "priceDesc", "endingAsc"]);

export const saleLotsPageDataSchema = z
  .object({
    items: z.array(z.unknown()),
    total: z.coerce.number(),
    limit: z.coerce.number(),
    offset: z.coerce.number(),
    sort: z.string().optional(),
  })
  .transform(
    (data): SaleLotsPage => ({
      items: data.items.filter((lot) => !isWithdrawnLotRow(lot)).map((lot) => lotSchema.parse(lot)),
      withdrawn: data.items
        .filter(isWithdrawnLotRow)
        .map(toWithdrawnRow)
        .filter((row): row is WithdrawnCatalogueRow => row !== null),
      total: data.total,
      limit: data.limit,
      offset: data.offset,
      sort: saleLotsSortSchema.safeParse(data.sort).success
        ? (data.sort as SaleLotsPage["sort"])
        : "lot",
    }),
  ) as unknown as z.ZodType<SaleLotsPage>;

export const saleRegistrationItemsSchema = z.object({
  items: z.array(z.unknown()),
});

export const saleListRowSchema = z
  .unknown()
  .transform((row) => parseSaleListRowApiPayload(row)) as z.ZodType<SaleListRow>;

export const sitemapSaleRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): SitemapSale | null => {
    const saleRaw = row.sale;
    if (typeof saleRaw !== "object" || saleRaw === null) return null;
    const sale = saleRaw as Record<string, unknown>;
    const id = String(sale.id ?? "");
    const title = String(sale.title ?? "");
    if (!id || !title) return null;
    return { id, title };
  }) as z.ZodType<SitemapSale | null>;

export const bidderCountSchema = z.object({ total: z.coerce.number().optional() });
