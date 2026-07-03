import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../lib/admin-legal-entity-browse.types.js";

export interface IAdminLegalEntityBrowseReader {
  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult>;
}

export type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
} from "../lib/admin-legal-entity-browse.types.js";
