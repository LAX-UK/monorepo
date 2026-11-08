import type { Database } from "@auction/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  DrizzleAccountDeletionEligibilityReader,
  PAYOUT_STATUSES_BLOCKING_DELETION,
} from "./drizzle-account-deletion-eligibility.reader.js";

/** A db whose select chain records the where clause and answers with the given rows. */
function fakeDb(rows: unknown[]) {
  const seen: { where?: Parameters<PgDialect["sqlToQuery"]>[0] } = {};
  const chain = {
    from: () => chain,
    where: (clause: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      seen.where = clause;
      return chain;
    },
    limit: async () => rows,
  };
  return { db: { select: () => chain } as unknown as Database, seen };
}

describe("DrizzleAccountDeletionEligibilityReader.hasOpenPayoutForEntities", () => {
  it("blocks on every payout status where the seller's money is unresolved", () => {
    expect([...PAYOUT_STATUSES_BLOCKING_DELETION].sort()).toEqual([
      "clawback_pending",
      "failed",
      "in_transit",
      "scheduled",
      "transfer_blocked",
    ]);
  });

  it("does not block on settled payouts", () => {
    expect(PAYOUT_STATUSES_BLOCKING_DELETION).not.toContain("paid");
    expect(PAYOUT_STATUSES_BLOCKING_DELETION).not.toContain("reversed");
  });

  it("queries those statuses and answers true when one is found", async () => {
    const { db, seen } = fakeDb([{ id: "p1" }]);
    const reader = new DrizzleAccountDeletionEligibilityReader(db);

    await expect(reader.hasOpenPayoutForEntities(["e1"])).resolves.toBe(true);

    const query = new PgDialect().sqlToQuery(seen.where as never);
    expect(query.params).toEqual(["e1", ...PAYOUT_STATUSES_BLOCKING_DELETION]);
  });

  it("answers false when no such payout exists, and for no entities without a query", async () => {
    const none = fakeDb([]);
    await expect(
      new DrizzleAccountDeletionEligibilityReader(none.db).hasOpenPayoutForEntities(["e1"]),
    ).resolves.toBe(false);
    const skipped = fakeDb([{ id: "p1" }]);
    await expect(
      new DrizzleAccountDeletionEligibilityReader(skipped.db).hasOpenPayoutForEntities([]),
    ).resolves.toBe(false);
    expect(skipped.seen.where).toBeUndefined();
  });
});
