import type {
  SaleLotsPage,
  SaleRegistrationMineRow,
  SaleShell,
  SaleViewerState,
  SaleWithLots,
  SitemapSale,
} from "@/lib/data/http/sales.schema";
import type { Sale } from "@auction/types";

export type ListSalesQuery = {
  status?: Sale["status"];
  statuses?: Sale["status"][];
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: "createdDesc" | "startAsc";
};

export type {
  SaleViewerState,
  SaleWithLots,
  SaleShell,
  SaleLotsPage,
  SaleRegistrationMineRow,
  SitemapSale,
};

export type GetSaleLotsPageParams = {
  id: string;
  page?: number;
  pageSize?: number;
  sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc";
};
