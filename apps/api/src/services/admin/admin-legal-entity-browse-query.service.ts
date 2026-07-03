import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../../lib/admin-legal-entity-browse.js";
import type { IAdminLegalEntityBrowseReader } from "../../repositories/interfaces/admin-legal-entity-browse.reader.js";
import type { IAdminLegalEntityBrowseQueryService } from "../interfaces/admin-routes.js";

export class AdminLegalEntityBrowseQueryService implements IAdminLegalEntityBrowseQueryService {
  constructor(private readonly reader: IAdminLegalEntityBrowseReader) {}

  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult> {
    return this.reader.searchLegalEntitiesBrowse(params);
  }
}
