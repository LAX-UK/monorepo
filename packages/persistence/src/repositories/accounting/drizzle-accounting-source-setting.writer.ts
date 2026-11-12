import {
  type Result,
  type SwitchCode,
  type SwitchConfig,
  ok,
  refuse,
  validateSwitchConfig,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingSourceSetting } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  AccountingClock,
  IAccountingSourceSettingWriter,
  SourceSettingChange,
} from "../../interfaces/accounting.js";

export class DrizzleAccountingSourceSettingWriter implements IAccountingSourceSettingWriter {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  /**
   * Locks every product's row, applies the change to the whole configuration and lets the domain
   * validate it (one live source per product) before anything is written; the database's CHECK
   * constraint is the second gate.
   */
  update(change: SourceSettingChange): Promise<Result<SwitchConfig, SwitchCode | "not_found">> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.select().from(accountingSourceSetting).for("update");
      const config: Record<string, { xero: string; books: string }> = {};
      for (const row of rows) config[row.product] = { xero: row.xeroMode, books: row.booksMode };
      const current = config[change.product];
      if (!current) return refuse("not_found", `no switch row for ${change.product}`);
      config[change.product] = {
        xero: change.xero ?? current.xero,
        books: change.books ?? current.books,
      };
      const valid = validateSwitchConfig(config);
      if (!valid.ok) return valid;
      await tx
        .update(accountingSourceSetting)
        .set({
          xeroMode: config[change.product]?.xero as SwitchConfig["bid"]["xero"],
          booksMode: config[change.product]?.books as SwitchConfig["bid"]["books"],
          updatedAt: this.clock.now(),
          updatedBy: change.updatedBy,
        })
        .where(eq(accountingSourceSetting.product, change.product));
      return ok(config as unknown as SwitchConfig);
    });
  }
}
