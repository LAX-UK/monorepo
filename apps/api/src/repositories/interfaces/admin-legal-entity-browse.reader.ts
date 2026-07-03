import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../../lib/admin-legal-entity-browse.js";

export interface IAdminLegalEntityBrowseReader {
  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult>;
}

export type { AdminLegalEntityBrowseParams, AdminLegalEntityBrowseResult };
