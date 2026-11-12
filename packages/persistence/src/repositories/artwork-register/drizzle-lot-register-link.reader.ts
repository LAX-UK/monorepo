import type { Database } from "@auction/db";
import { atgLotLink, lot } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IAtgLotSoldReader,
  ILotRegisterLinkReader,
  LotRegisterLink,
} from "../../interfaces/artwork-register.js";

export class DrizzleLotRegisterLinkReader implements ILotRegisterLinkReader, IAtgLotSoldReader {
  constructor(private readonly db: Database) {}

  async findLink(lotId: string): Promise<LotRegisterLink | null> {
    const [row] = await this.db
      .select({
        registerId: lot.artworkRegisterId,
        status: lot.status,
        winnerId: lot.winnerId,
        atgSold: atgLotLink.sold,
      })
      .from(lot)
      .leftJoin(atgLotLink, eq(atgLotLink.lotId, lot.id))
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!row?.registerId) return null;
    return {
      registerId: row.registerId,
      status: row.status,
      hasWinner: row.winnerId !== null,
      soldOnAtg: row.atgSold === true,
    };
  }

  async soldOnAtg(lotId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ sold: atgLotLink.sold })
      .from(atgLotLink)
      .where(and(eq(atgLotLink.lotId, lotId), eq(atgLotLink.sold, true)))
      .limit(1);
    return row !== undefined;
  }
}
