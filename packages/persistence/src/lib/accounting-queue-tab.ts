import { LOCKED_PERIOD_REASON_SUFFIX, type QueueTab } from "@auction/accounting-domain";
import { accountingDocument } from "@auction/db/schema";
import { type SQL, sql } from "drizzle-orm";

const d = accountingDocument;
/** `LIKE` pattern for a locked-period refusal; `_` is escaped so it matches only itself. */
const LOCKED_PERIOD_LIKE = `%${LOCKED_PERIOD_REASON_SUFFIX.replaceAll("_", "\\_")}`;

const lockedPeriod = sql`(${d.state} = 'failed' and ${d.lastErrorClass} like ${LOCKED_PERIOD_LIKE})`;

/** The SQL for each tab, the same rule as the domain's `queueTabFor`. */
export const QUEUE_TAB_WHERE: Readonly<Record<QueueTab, SQL>> = {
  needs_person: sql`(${d.state} = 'needs_review' or ${lockedPeriod})`,
  failed: sql`(${d.state} = 'failed' and not ${lockedPeriod})`,
  waiting: sql`${d.state} in ('pending', 'sending', 'unknown')`,
  issued: sql`${d.state} = 'issued'`,
};
