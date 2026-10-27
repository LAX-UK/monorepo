import type { Database } from "@auction/db";
import { itemSubmission, lot } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  AccountRecordKind,
  IRecordAccountReader,
} from "../interfaces/record-account.reader.js";

type OwnerQuery = (db: Database, id: string) => Promise<string | null>;

/** One row per record kind; a new linkable record is one entry here. */
const OWNER_QUERIES: Record<AccountRecordKind, OwnerQuery> = {
  consignment: async (db, id) => {
    const [row] = await db
      .select({ owner: itemSubmission.legalEntityId })
      .from(itemSubmission)
      .where(eq(itemSubmission.id, id))
      .limit(1);
    return row?.owner ?? null;
  },
  // A purchase belongs to the account the lot was won as.
  purchase: async (db, id) => {
    const [row] = await db
      .select({ owner: lot.buyerLegalEntityId })
      .from(lot)
      .where(eq(lot.id, id))
      .limit(1);
    return row?.owner ?? null;
  },
};

export class DrizzleRecordAccountReader implements IRecordAccountReader {
  constructor(private readonly db: Database) {}

  findOwningAccount(kind: AccountRecordKind, id: string): Promise<string | null> {
    return OWNER_QUERIES[kind](this.db, id);
  }
}
