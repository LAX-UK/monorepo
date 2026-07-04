import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ILotNotifyReader } from "../interfaces/lot-notify.reader.js";

export class DrizzleLotNotifyReader implements ILotNotifyReader {
  constructor(private readonly db: Database) {}

  async getLotTitle(lotId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ title: lot.title })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    return row?.title ?? null;
  }
}
