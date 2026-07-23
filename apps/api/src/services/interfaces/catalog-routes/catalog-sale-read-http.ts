import type {
  listSaleBiddersQuerySchema,
  listSaleLotsQuerySchema,
  listSalesQuerySchema,
} from "@auction/validators";
import type { z } from "zod";
import type { CatalogHttpJson, CatalogViewerContext } from "./catalog-read-http.js";

export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
export type ListSaleLotsQuery = z.infer<typeof listSaleLotsQuerySchema>;
export type ListSaleBiddersQuery = z.infer<typeof listSaleBiddersQuerySchema>;

export interface ICatalogSaleReadHttpApplicationService {
  listSales(input: {
    query: ListSalesQuery;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson>;

  getSaleroomStatus(input: { saleId: string }): Promise<CatalogHttpJson>;

  getSaleDetail(input: { saleId: string; viewer: CatalogViewerContext }): Promise<CatalogHttpJson>;

  getCatalogAdminDetail(input: {
    saleId: string;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson>;

  listSaleLotsPage(input: {
    saleId: string;
    query: ListSaleLotsQuery;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson>;

  listSaleBidders(input: {
    saleId: string;
    query: ListSaleBiddersQuery;
  }): Promise<CatalogHttpJson>;
}
