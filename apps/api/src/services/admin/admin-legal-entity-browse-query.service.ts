import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseRow,
  AdminLegalEntityBrowseSummary,
  IAdminLegalEntityBrowseReader,
} from "@auction/persistence/interfaces";
import type { IAdminLegalEntityBrowseQueryService } from "../interfaces/admin-routes.js";

export type AdminLegalEntityBrowsePage = {
  rows: AdminLegalEntityBrowseRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminLegalEntityBrowseSummary;
};

export class AdminLegalEntityBrowseQueryService implements IAdminLegalEntityBrowseQueryService {
  constructor(private readonly reader: IAdminLegalEntityBrowseReader) {}

  async getPage(params: AdminLegalEntityBrowseParams): Promise<AdminLegalEntityBrowsePage> {
    const result = await this.reader.searchLegalEntitiesBrowse(params);
    return {
      rows: result.rows,
      total: result.total,
      offset: params.offset,
      limit: params.limit,
      summary: result.summary,
    };
  }

  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<Awaited<ReturnType<IAdminLegalEntityBrowseReader["searchLegalEntitiesBrowse"]>>> {
    return this.reader.searchLegalEntitiesBrowse(params);
  }
}
