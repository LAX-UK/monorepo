import type {
  AdminLegalEntityBrowseFilter,
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseSummary,
} from "../lib/admin-legal-entity-browse.types.js";

export interface IAdminLegalEntityBrowseReader {
  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult>;
  summarizeLegalEntitiesBrowse(
    filter: AdminLegalEntityBrowseFilter,
  ): Promise<AdminLegalEntityBrowseSummary>;
}

export type {
  AdminLegalEntityBrowseFilter,
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
  AdminLegalEntityBrowseSummary,
} from "../lib/admin-legal-entity-browse.types.js";
