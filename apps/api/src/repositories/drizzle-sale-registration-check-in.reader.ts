import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { sale, user } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ISaleRegistrationCheckInReader,
  SaleCheckInGateRow,
  UserCheckInGateRow,
} from "./interfaces/sale-registration-check-in.reader.js";

export class DrizzleSaleRegistrationCheckInReader implements ISaleRegistrationCheckInReader {
  constructor(private readonly db: Database) {}

  async findSaleForCheckIn(saleId: string): Promise<SaleCheckInGateRow | null> {
    const [row] = await this.db
      .select({ id: sale.id, status: sale.status, deliveryMode: sale.deliveryMode })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    return row ?? null;
  }

  async findUserForCheckIn(userId: string): Promise<UserCheckInGateRow | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        emailVerified: user.emailVerified,
        kycStatus: user.kycStatus,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }
}
