import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { sale, saleRegistration } from "@auction/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { IGuestPaddleReader } from "./interfaces/guest-paddle.reader.js";

export class DrizzleGuestPaddleReader implements IGuestPaddleReader {
  constructor(private readonly db: Database) {}

  async findCheckedInPaddle(saleId: string, userId: string): Promise<number | null> {
    const [row] = await this.db
      .select({ paddleNumber: saleRegistration.paddleNumber })
      .from(saleRegistration)
      .innerJoin(sale, eq(sale.id, saleRegistration.saleId))
      .where(
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.userId, userId),
          isNotNull(saleRegistration.checkedInAt),
          isNotNull(saleRegistration.paddleNumber),
          saleNotDeleted(),
        ),
      )
      .orderBy(desc(saleRegistration.checkedInAt))
      .limit(1);
    return row?.paddleNumber ?? null;
  }
}
