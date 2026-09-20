import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";
import type { ShopReadinessPort } from "../application/ports/shop-readiness.port.js";

export function createDrizzleShopReadinessAdapter(db: Database): ShopReadinessPort {
  return {
    async checkConnectivity() {
      await db.execute(sql`select 1`);
    },
    async checkCatalogueSchema() {
      const result = await db.execute<{ ok: number }>(sql`
        select 1 as ok
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'shop_artwork'
          and column_name = 'print_price_pence'
        limit 1
      `);
      if (result.rows.length === 0) {
        throw new Error("shop catalogue schema is not ready");
      }
    },
  };
}
