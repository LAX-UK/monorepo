import { type Database, closeDb, createDb } from "@auction/db";
import { dataRequestErasureHold } from "@auction/db/schema";
import { like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DrizzleHeldErasures } from "./drizzle-data-request-held-erasures.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const PREFIX = "DR-99";
const STAFF = "held-erasures-staff";

describe.skipIf(!HAS_DB)("DrizzleHeldErasures (integration)", () => {
  let db: Database;
  let holds: DrizzleHeldErasures;

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL as string);
    holds = new DrizzleHeldErasures(db);
    await deleteIdentityUserFixtures(db, [STAFF]);
    await seedIdentityUserFixtures(db, [{ id: STAFF, name: "Staff", email: "held@example.test" }]);
  });
  beforeEach(async () => {
    await db
      .delete(dataRequestErasureHold)
      .where(like(dataRequestErasureHold.reference, `${PREFIX}%`));
  });
  afterAll(async () => {
    await db
      .delete(dataRequestErasureHold)
      .where(like(dataRequestErasureHold.reference, `${PREFIX}%`));
    await deleteIdentityUserFixtures(db, [STAFF]);
    await closeDb(db);
  });

  const waiting = (at: Date) =>
    ({ state: "waiting", reason: "running", heldUntil: at, recheckAt: at }) as const;
  const noEnd = {
    state: "needs_staff",
    reason: "end_unknown",
    heldUntil: null,
    recheckAt: null,
  } as const;

  it("lists only holds staff must settle, and replaces a request's earlier hold", async () => {
    const at = new Date("2031-03-01T00:00:00Z");
    await holds.held({ reference: `${PREFIX}01`, requestedByUserId: STAFF, plan: waiting(at) });
    await holds.held({ reference: `${PREFIX}02`, requestedByUserId: STAFF, plan: noEnd });
    const mine = async () =>
      (await holds.needingStaff()).filter((flag) => flag.reference.startsWith(PREFIX));
    expect(await mine()).toEqual([
      { reference: `${PREFIX}02`, reason: "end_unknown", heldUntil: null },
    ]);

    await holds.held({ reference: `${PREFIX}01`, requestedByUserId: STAFF, plan: noEnd });
    expect((await mine()).map((flag) => flag.reference).sort()).toEqual([
      `${PREFIX}01`,
      `${PREFIX}02`,
    ]);

    await holds.cleared(`${PREFIX}01`);
    expect((await mine()).map((flag) => flag.reference)).toEqual([`${PREFIX}02`]);
  });
});
