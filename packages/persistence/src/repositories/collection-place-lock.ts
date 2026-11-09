import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

/** Anything that can run a statement: the database, or a transaction on it. */
type Statements = Pick<Database, "execute">;

/**
 * Serialises the writes that decide what a collection place offers and who holds a place in it:
 * making or moving a booking, and changing the place's hours, rules or closures. The lock lasts
 * to the end of the transaction. A staff change that lists the visits it would affect checks that
 * list again under this lock, and a booking cannot slip in between the check and the change.
 * Always take it before locking any booking row, so two transactions never wait on each other.
 */
export async function lockCollectionPlace(conn: Statements, venueId: string): Promise<void> {
  await conn.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`collection_place:${venueId}`}, 0))`,
  );
}
