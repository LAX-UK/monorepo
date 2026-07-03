import type { LotStatus } from "@auction/types";
import type {
  AdminAttachableLotRow,
  AdminLotBrowseInput,
} from "../../services/admin/admin-lot-browse.types.js";

export type AdminLotBrowseRawRow = {
  id: string;
  title: string;
  status: LotStatus;
  sellerLegalEntityId: string;
  saleId: string | null;
  artistId: string | null;
  createdAt: Date;
  returnCount: number | null;
  returnedToInventoryAt: Date | null;
  lastSaleId: string | null;
};

export interface IAdminLotBrowseReader {
  countAttachable(input: AdminLotBrowseInput): Promise<number>;
  listAttachableRows(input: AdminLotBrowseInput): Promise<AdminLotBrowseRawRow[]>;
  findSaleTitlesByIds(saleIds: string[]): Promise<Map<string, string>>;
}

export type { AdminAttachableLotRow, AdminLotBrowseInput };
