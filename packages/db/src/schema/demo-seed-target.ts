import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A database's own statement that it may receive the demo seeds (migration 0398). At most one row.
 * Production never has one; an operator inserts it once on test and on a local database. The seeds
 * refuse a database without it, and one whose row names another database (a restored copy).
 */
export const demoSeedTarget = pgTable(
  "demo_seed_target",
  {
    id: boolean("id").primaryKey().default(true),
    environment: text("environment").notNull(),
    databaseName: text("database_name").notNull(),
    markedBy: text("marked_by").notNull(),
    markedAt: timestamp("marked_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("demo_seed_target_single_row_check", sql`${table.id}`),
    check("demo_seed_target_environment_check", sql`${table.environment} IN ('test', 'local')`),
  ],
);
