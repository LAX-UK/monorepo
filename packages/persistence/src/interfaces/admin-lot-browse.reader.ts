import type { AdminLotBrowseInput, AdminLotBrowseRawRow } from "../lib/admin-lot-browse.types.js";

export interface IAdminLotBrowseReader {
  countAttachable(input: AdminLotBrowseInput): Promise<number>;
  listAttachableRows(input: AdminLotBrowseInput): Promise<AdminLotBrowseRawRow[]>;
  findSaleTitlesByIds(saleIds: string[]): Promise<Map<string, string>>;
}

export type {
  AdminAttachableLotRow,
  AdminLotBrowseInput,
  AdminLotBrowseRawRow,
  AdminLotBrowseState,
} from "../lib/admin-lot-browse.types.js";
