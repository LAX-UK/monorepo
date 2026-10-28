import { shopEdition } from "@auction/db/schema";
import { sql } from "drizzle-orm";

/**
 * The number shown for a print in lists that still carry a single number per print. Every print
 * created so far is numbered, so this is its edition number; an unnumbered print falls back to
 * its stock reference until those lists show labels.
 */
export const printedEditionNumber = sql<number>`coalesce(${shopEdition.editionNumber}, ${shopEdition.stockRef})`;
