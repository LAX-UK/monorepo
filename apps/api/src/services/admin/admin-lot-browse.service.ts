import type { IAdminLotBrowseReader } from "../../repositories/interfaces/admin-lot-browse.reader.js";
import type { AdminAttachableLotRow, AdminLotBrowseInput } from "./admin-lot-browse.types.js";

export type {
  AdminAttachableLotRow,
  AdminLotBrowseInput,
  AdminLotBrowseState,
} from "./admin-lot-browse.types.js";

export class AdminLotBrowseService {
  constructor(private readonly reader: IAdminLotBrowseReader) {}

  async listAttachable(
    input: AdminLotBrowseInput,
  ): Promise<{ data: AdminAttachableLotRow[]; total: number }> {
    const [total, rows] = await Promise.all([
      this.reader.countAttachable(input),
      this.reader.listAttachableRows(input),
    ]);

    const saleIds = rows.map((r) => r.lastSaleId).filter((id): id is string => id != null);
    const saleNames = await this.reader.findSaleTitlesByIds(saleIds);

    const data: AdminAttachableLotRow[] = rows.map((r) => {
      const returnCount = r.returnCount ?? 0;
      const returnedAt = r.returnedToInventoryAt ?? null;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        sellerLegalEntityId: r.sellerLegalEntityId,
        saleId: r.saleId,
        artistId: r.artistId,
        createdAt: r.createdAt,
        lifecycle: {
          kind: returnCount > 0 ? "returned" : "new_draft",
          returnedAt,
          lastSaleId: r.lastSaleId,
          lastSaleName: r.lastSaleId ? (saleNames.get(r.lastSaleId) ?? null) : null,
          returnCount,
        },
      };
    });

    return { data, total };
  }
}
