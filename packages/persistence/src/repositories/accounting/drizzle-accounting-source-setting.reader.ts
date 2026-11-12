import {
  PRODUCTS,
  type Result,
  type SwitchCode,
  type SwitchConfig,
  parseSwitchConfig,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingSourceSetting } from "@auction/db/schema";
import type { IAccountingSourceSettingReader } from "../../interfaces/accounting.js";

export class DrizzleAccountingSourceSettingReader implements IAccountingSourceSettingReader {
  constructor(private readonly db: Database) {}

  async read(): Promise<Result<SwitchConfig, SwitchCode>> {
    const rows = await this.db.select().from(accountingSourceSetting);
    const config: Record<string, unknown> = {};
    for (const product of PRODUCTS) {
      const row = rows.find((r) => r.product === product);
      if (row) config[product] = { xero: row.xeroMode, books: row.booksMode };
    }
    // A missing product is the domain's `missing_product` refusal, never a silent default.
    return parseSwitchConfig(config);
  }
}
