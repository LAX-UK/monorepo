import type { pressArchiveQuerySchema, pressDayMediaQuerySchema } from "@auction/validators";
import type { z } from "zod";
import type { CatalogHttpJson, CatalogViewerContext } from "./catalog-read-http.js";

export type PressArchiveQuery = z.infer<typeof pressArchiveQuerySchema>;
export type PressDayMediaQuery = z.infer<typeof pressDayMediaQuerySchema>;

export interface ICatalogPressReadHttpApplicationService {
  listCoverage(input: {
    query: PressArchiveQuery;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson>;

  listDayMedia(input: {
    query: PressDayMediaQuery;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson>;

  getSitemapFreshness(input: { viewer: CatalogViewerContext }): Promise<CatalogHttpJson>;
}
