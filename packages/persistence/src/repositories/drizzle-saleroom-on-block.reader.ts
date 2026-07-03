import type { Database } from "@auction/db";
import { saleroomSession } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ISaleroomOnBlockReader } from "../interfaces/saleroom-on-block.reader.js";

export class DrizzleSaleroomOnBlockReader implements ISaleroomOnBlockReader {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): ISaleroomOnBlockReader {
    return new DrizzleSaleroomOnBlockReader(conn);
  }

  async getSessionState(saleId: string) {
    const [session] = await this.db
      .select({
        status: saleroomSession.status,
        currentLotId: saleroomSession.currentLotId,
      })
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);
    return session ?? null;
  }
}
