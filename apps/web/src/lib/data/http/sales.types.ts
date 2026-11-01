import type {
  SaleLotsPage,
  SaleRegistrationMineRow,
  SaleShell,
  SaleViewerState,
  SaleWithLots,
  SitemapSale,
  WithdrawnCatalogueRow,
} from "@/lib/data/http/sales.schema";
import type { Sale } from "@auction/types";

export type ListSalesQuery = {
  status?: Sale["status"];
  statuses?: Sale["status"][];
  categoryId?: string;
  limit?: number;
  offset?: number;
  /** `endDesc`: most recently ended first (results). */
  sort?: "createdDesc" | "startAsc" | "endDesc";
};

export type {
  SaleViewerState,
  SaleWithLots,
  SaleShell,
  SaleLotsPage,
  SaleRegistrationMineRow,
  SitemapSale,
  WithdrawnCatalogueRow,
};

export type GetSaleLotsPageParams = {
  id: string;
  page?: number;
  pageSize?: number;
  sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc";
};
