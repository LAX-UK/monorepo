import { vi } from "vitest";
import { CatalogPressReadHttpApplicationService } from "../services/catalog/catalog-press-read-http-application.service.js";
import type { ICatalogPressReadHttpApplicationService } from "../services/interfaces/catalog-routes/catalog-press-read-http.js";
import type { IPressArchiveReadService } from "../services/interfaces/press-archive-read.service.js";

export function createCatalogPressReadHttpFixture(
  pressArchiveReadService: IPressArchiveReadService,
): ICatalogPressReadHttpApplicationService {
  return new CatalogPressReadHttpApplicationService(pressArchiveReadService);
}

export function mockPressArchiveReadService(
  overrides: Partial<IPressArchiveReadService> = {},
): IPressArchiveReadService {
  return {
    listCoverage: vi.fn(),
    listDayMediaSales: vi.fn(),
    getSitemapFreshness: vi.fn(),
    ...overrides,
  };
}
