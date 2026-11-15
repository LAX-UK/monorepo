import { type Database, closeDb, createDb } from "@auction/db";
import { dataRequestErasureHold } from "@auction/db/schema";
import { like, sql } from "drizzle-orm";
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

  it("gives each due request to one of two runs at once, and again only after the claim runs out", async () => {
    const due = new Date("2031-03-01T00:00:00Z");
    const now = new Date("2031-03-02T00:00:00Z");
    for (const n of ["11", "12", "13", "14"]) {
      await holds.held({
        reference: `${PREFIX}${n}`,
        requestedByUserId: STAFF,
        plan: waiting(due),
      });
    }
    await holds.held({
      reference: `${PREFIX}15`,
      requestedByUserId: STAFF,
      plan: waiting(new Date("2031-04-01T00:00:00Z")),
    });
    await holds.held({ reference: `${PREFIX}16`, requestedByUserId: STAFF, plan: noEnd });
    const otherDb = createDb(process.env.DATABASE_URL as string);
    const other = new DrizzleHeldErasures(otherDb);
    const mine = (rows: { reference: string }[]) =>
      rows.map((row) => row.reference).filter((ref) => ref.startsWith(PREFIX));
    const [first, second] = await Promise.all([
      holds.claimDue(now, 100, 60_000),
      other.claimDue(now, 100, 60_000),
    ]).finally(() => closeDb(otherDb));
    const taken = [...mine(first), ...mine(second)].sort();
    expect(taken).toEqual([`${PREFIX}11`, `${PREFIX}12`, `${PREFIX}13`, `${PREFIX}14`]);
    expect(new Set(taken).size).toBe(taken.length);

    expect(mine(await holds.claimDue(now, 100, 60_000))).toEqual([]);
    const later = new Date(now.getTime() + 60_000);
    expect(mine(await holds.claimDue(later, 100, 60_000)).sort()).toEqual(taken);
  });

  it("passes over a request another run is claiming, without waiting for it", async () => {
    const due = new Date("2031-03-01T00:00:00Z");
    const now = new Date("2031-03-02T00:00:00Z");
    for (const n of ["31", "32"]) {
      await holds.held({
        reference: `${PREFIX}${n}`,
        requestedByUserId: STAFF,
        plan: waiting(due),
      });
    }
    const mine = (rows: { reference: string }[]) =>
      rows.map((row) => row.reference).filter((ref) => ref.startsWith(PREFIX));
    // Another run is mid-claim: it has the first row locked and has not committed.
    const taken = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM "data_request_erasure_hold" WHERE "reference" = ${`${PREFIX}31`} FOR UPDATE`,
      );
      const timedOut = new Promise<"blocked">((done) => setTimeout(() => done("blocked"), 2_000));
      return Promise.race([holds.claimDue(now, 100, 60_000), timedOut]);
    });
    expect(taken === "blocked" ? taken : mine(taken)).toEqual([`${PREFIX}32`]);
  });

  it("stops re-running a request handed to staff, and shows it in the queue", async () => {
    const due = new Date("2031-03-01T00:00:00Z");
    await holds.held({ reference: `${PREFIX}21`, requestedByUserId: STAFF, plan: waiting(due) });
    await holds.needsStaff(`${PREFIX}21`, "still_held");
    const now = new Date("2031-03-02T00:00:00Z");
    expect((await holds.claimDue(now, 100, 60_000)).map((row) => row.reference)).not.toContain(
      `${PREFIX}21`,
    );
    expect(await holds.needingStaff()).toContainEqual({
      reference: `${PREFIX}21`,
      reason: "still_held",
      heldUntil: due.toISOString(),
    });
  });
});
