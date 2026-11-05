import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ILotRegisterLinkReader, LotRegisterLink } from "../../interfaces/artwork-register.js";

export class DrizzleLotRegisterLinkReader implements ILotRegisterLinkReader {
  constructor(private readonly db: Database) {}

  async findLink(lotId: string): Promise<LotRegisterLink | null> {
    const [row] = await this.db
      .select({ registerId: lot.artworkRegisterId, status: lot.status, winnerId: lot.winnerId })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!row?.registerId) return null;
    return { registerId: row.registerId, status: row.status, hasWinner: row.winnerId !== null };
  }
}
