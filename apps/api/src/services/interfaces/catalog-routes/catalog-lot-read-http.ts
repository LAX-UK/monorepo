import type { listLotsQuerySchema } from "@auction/validators";
import type { z } from "zod";
import type { CatalogHttpJson, CatalogViewerContext } from "./catalog-read-http.js";

export type ListLotsQuery = z.infer<typeof listLotsQuerySchema>;

export interface ICatalogLotReadHttpApplicationService {
  listLots(input: { query: ListLotsQuery; viewer: CatalogViewerContext }): Promise<CatalogHttpJson>;

  archiveSummary(input: {
    endYear?: number | undefined;
  }): Promise<CatalogHttpJson>;

  archiveCount(input: {
    categoryId?: string | undefined;
    categoryIds?: string[] | undefined;
    endYear?: number | undefined;
  }): Promise<CatalogHttpJson>;

  countLots(input: {
    query: ListLotsQuery;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson>;

  getLotDetail(input: { lotId: string; viewer: CatalogViewerContext }): Promise<CatalogHttpJson>;

  getWatchCount(input: { lotId: string }): Promise<CatalogHttpJson>;

  listLotDocuments(input: { lotId: string }): Promise<CatalogHttpJson>;
}
