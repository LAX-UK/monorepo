import type { CatalogueGap } from "@auction/artwork-register-contracts";
import { artworkRegister as register } from "@auction/db/schema";
import { type SQL, and, eq, sql } from "drizzle-orm";
import type { RegisterQueueFilter } from "../../interfaces/artwork-register-queue.js";

/** The SQL for each gap, matching `catalogueGapsOf` in the contracts package. */
const GAP_CONDITIONS: Record<CatalogueGap, SQL> = {
  image: sql`jsonb_array_length(${register.imageRefs}) = 0`,
  size: sql`(${register.dimensions} IS NULL OR btrim(${register.dimensions}) = '')`,
  medium: sql`(${register.medium} IS NULL OR btrim(${register.medium}) = '')`,
};

export function queueFilterCondition(filter: RegisterQueueFilter): SQL | undefined {
  return and(
    filter.artistCode ? eq(register.artistCode, filter.artistCode) : undefined,
    filter.missing ? GAP_CONDITIONS[filter.missing] : undefined,
  );
}
