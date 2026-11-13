import type { TargetMode } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { and, eq, inArray, min, sql } from "drizzle-orm";
import type {
  AccountingAttention,
  IAccountingAttentionReader,
  QueueAge,
} from "../../interfaces/accounting.js";
import { QUEUE_TAB_WHERE } from "../../lib/accounting-queue-tab.js";

const d = accountingDocument;

export class DrizzleAccountingAttentionReader implements IAccountingAttentionReader {
  constructor(private readonly db: Database) {}

  async read(pendingModes: readonly TargetMode[]): Promise<AccountingAttention> {
    const [needsPerson, pending] = await Promise.all([
      this.age(QUEUE_TAB_WHERE.needs_person),
      pendingModes.length === 0
        ? Promise.resolve<QueueAge>({ count: 0, oldestSince: null })
        : this.age(
            and(
              eq(d.state, "pending"),
              eq(d.targetProvider, "books"),
              inArray(d.targetMode, [...pendingModes]),
            ),
          ),
    ]);
    return { needsPerson, pending };
  }

  private async age(where: ReturnType<typeof and>): Promise<QueueAge> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number), oldest: min(d.updatedAt) })
      .from(d)
      .where(where);
    return { count: row?.count ?? 0, oldestSince: row?.oldest ?? null };
  }
}
