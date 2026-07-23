import { normalizeUserStaffRole } from "@auction/types";
import type { ICatalogPressReadHttpApplicationService } from "../interfaces/catalog-routes/catalog-press-read-http.js";
import type { CatalogHttpJson } from "../interfaces/catalog-routes/catalog-read-http.js";
import type {
  IPressArchiveReadService,
  PressArchiveListResult,
} from "../interfaces/press-archive-read.service.js";

function serializePressArchiveListResult(result: PressArchiveListResult) {
  return {
    data: result.data.map((entry) => ({
      sale: {
        ...entry.sale,
        endTime: entry.sale.endTime?.toISOString() ?? null,
        updatedAt: entry.sale.updatedAt.toISOString(),
      },
      item: entry.item,
    })),
    meta: {
      total: result.meta.total,
      archiveTotal: result.meta.archiveTotal,
      outletCount: result.meta.outletCount,
      lastUpdated: result.meta.lastUpdated?.toISOString() ?? null,
      availableYears: result.meta.availableYears,
    },
  };
}

export class CatalogPressReadHttpApplicationService
  implements ICatalogPressReadHttpApplicationService
{
  constructor(private readonly pressArchiveReadService: IPressArchiveReadService) {}

  async listCoverage(input: {
    query: Parameters<ICatalogPressReadHttpApplicationService["listCoverage"]>[0]["query"];
    viewer: Parameters<ICatalogPressReadHttpApplicationService["listCoverage"]>[0]["viewer"];
  }): Promise<CatalogHttpJson> {
    const query = input.query;
    const viewer = {
      role: input.viewer.role ?? undefined,
      staffRole: normalizeUserStaffRole(input.viewer.staffRole ?? undefined),
    };
    const result = await this.pressArchiveReadService.listCoverage(
      {
        limit: query.limit,
        offset: query.offset,
        ...(query.year !== undefined ? { year: query.year } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
        ...(query.mentionType !== undefined ? { mentionType: query.mentionType } : {}),
      },
      viewer,
    );
    return { status: 200, body: serializePressArchiveListResult(result) };
  }

  async listDayMedia(input: {
    query: Parameters<ICatalogPressReadHttpApplicationService["listDayMedia"]>[0]["query"];
    viewer: Parameters<ICatalogPressReadHttpApplicationService["listDayMedia"]>[0]["viewer"];
  }): Promise<CatalogHttpJson> {
    const viewer = {
      role: input.viewer.role ?? undefined,
      staffRole: normalizeUserStaffRole(input.viewer.staffRole ?? undefined),
    };
    const data = await this.pressArchiveReadService.listDayMediaSales(input.query.limit, viewer);
    return {
      status: 200,
      body: {
        data: data.map((row) => ({
          ...row,
          endTime: row.endTime?.toISOString() ?? null,
        })),
      },
    };
  }

  async getSitemapFreshness(input: {
    viewer: Parameters<ICatalogPressReadHttpApplicationService["getSitemapFreshness"]>[0]["viewer"];
  }): Promise<CatalogHttpJson> {
    const viewer = {
      role: input.viewer.role ?? undefined,
      staffRole: normalizeUserStaffRole(input.viewer.staffRole ?? undefined),
    };
    const data = await this.pressArchiveReadService.getSitemapFreshness(viewer);
    return {
      status: 200,
      body: {
        data: data.map((row) => ({
          ...row,
          lastModified: row.lastModified.toISOString(),
        })),
      },
    };
  }
}
