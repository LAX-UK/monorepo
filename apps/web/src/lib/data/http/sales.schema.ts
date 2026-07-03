import { lotSchema } from "@/lib/data/http/lot.schema";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { saleSchema } from "@/lib/data/http/sale.schema";
import { parseSaleListRowApiPayload } from "@/lib/sale-list-row";
import type { SaleListRow } from "@/lib/sale-list-row";
import type { Lot, Sale } from "@auction/types";
import { z } from "zod";

export type SaleViewerState = {
  isFollowing: boolean;
};

export type SaleWithLots = { sale: Sale; lots: Lot[]; viewer?: SaleViewerState };

export type SaleShell = { sale: Sale; viewer?: SaleViewerState };

export type SaleLotsPage = {
  items: Lot[];
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

export const saleShellDataSchema = z
  .object({
    sale: z.unknown(),
    viewer: viewerStateSchema.optional(),
  })
  .transform((data): SaleShell => {
    const sale = saleSchema.parse(data.sale);
    return data.viewer ? { sale, viewer: data.viewer } : { sale };
  }) as z.ZodType<SaleShell>;

export const saleWithLotsDataSchema = z
  .object({
    sale: z.unknown(),
    lots: z.array(z.unknown()),
    viewer: viewerStateSchema.optional(),
  })
  .transform((data): SaleWithLots => {
    const base = {
      sale: saleSchema.parse(data.sale),
      lots: data.lots.map((lot) => lotSchema.parse(lot)),
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
      items: data.items.map((lot) => lotSchema.parse(lot)),
      total: data.total,
      limit: data.limit,
      offset: data.offset,
      sort: saleLotsSortSchema.safeParse(data.sort).success
        ? (data.sort as SaleLotsPage["sort"])
        : "lot",
    }),
  ) as z.ZodType<SaleLotsPage>;

export const saleRegistrationItemsSchema = z.object({
  items: z.array(z.unknown()),
});

export const saleListRowSchema = z.custom<SaleListRow>((row) =>
  parseSaleListRowApiPayload(row),
) as z.ZodType<SaleListRow>;

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
