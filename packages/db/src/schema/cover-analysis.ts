import type { CoverAnalysis } from "@auction/types";
import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * What the worker measured from a cover picture: its colours, a blur preview and the scrim that
 * keeps text over it readable. Keyed by the fingerprint of the picture, crop and text side, so a
 * sale slot reads the row its own fingerprint names and a changed crop simply has no row yet.
 * A row with status `failed` records that the picture could not be read, so it is not retried
 * until the fingerprint changes.
 */
export const coverAnalysis = pgTable(
  "cover_analysis",
  {
    hash: text("hash").primaryKey(),
    status: text("status").notNull(),
    analysis: jsonb("analysis").$type<CoverAnalysis>(),
    analysedAt: timestamp("analysed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("cover_analysis_status_check", sql`${table.status} IN ('ready', 'failed')`),
    check(
      "cover_analysis_ready_has_analysis",
      sql`(${table.status} = 'ready') = (${table.analysis} IS NOT NULL)`,
    ),
    index("cover_analysis_analysed_at_idx").on(table.analysedAt),
  ],
);
