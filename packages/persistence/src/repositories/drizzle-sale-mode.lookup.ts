import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, sale } from "@auction/db/schema";
import type { SaleDeliveryMode } from "@auction/types";
import { and, eq } from "drizzle-orm";
import type { ISaleModeLookup } from "../interfaces/sale-mode.lookup.js";

/** Single-purpose Drizzle implementation of {@link ISaleModeLookup}.
 * * One small SELECT joining `lot.sale_id` to `sale.delivery_mode`; intentionally
 * does not reuse the full sale repository (Interface Segregation).
 */
export class DrizzleSaleModeLookup implements ISaleModeLookup {
  constructor(private readonly db: Database) {}

  async findSaleModeForLot(lotId: string): Promise<SaleDeliveryMode | null> {
    const rows = await this.db
      .select({ deliveryMode: sale.deliveryMode })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return (row.deliveryMode as SaleDeliveryMode | null) ?? null;
  }
}
