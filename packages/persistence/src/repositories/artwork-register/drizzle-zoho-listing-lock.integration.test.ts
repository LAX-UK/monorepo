import { closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  DrizzleZohoListingLock,
  zohoListingLockKey,
  zohoListingLockPool,
} from "./drizzle-zoho-listing.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

type HolderRow = { pid: number; state: string | null; xact: boolean };

/** The backends holding the advisory lock for `registerId`, and whether each has a transaction open. */
async function holders(registerId: string): Promise<HolderRow[]> {
  const result = await db.execute<HolderRow>(sql`
    SELECT a.pid, a.state, a.xact_start IS NOT NULL AS xact
      FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
       AND l.classid::bigint = ((hashtext(${zohoListingLockKey(registerId)})::bigint >> 32) & 4294967295)
       AND l.objid::bigint = (hashtext(${zohoListingLockKey(registerId)})::bigint & 4294967295)`);
  return result.rows;
}

function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

async function waitFor(check: () => Promise<boolean>): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

describe("DrizzleZohoListingLock pool", () => {
  it("refuses a database with no pg pool, such as a transaction", () => {
    expect(() => zohoListingLockPool({} as never)).toThrow(/not a transaction/);
  });

  it("refuses to be built without a pool", () => {
    expect(() => new DrizzleZohoListingLock({} as never)).toThrow(/needs the pg pool/);
  });
});

describe.skipIf(!url)("DrizzleZohoListingLock (Postgres)", { timeout: 30_000 }, () => {
  const lock = new DrizzleZohoListingLock(zohoListingLockPool(db));

  afterAll(async () => {
    if (url) await closeDb(db);
  });

  it("holds the lock on a connection with no transaction open while fn runs", async () => {
    const id = crypto.randomUUID();
    const seen = await lock.withLock([id], () => holders(id));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.xact).toBe(false);
    expect(seen[0]?.state).not.toMatch(/in transaction/);
    expect(await holders(id)).toEqual([]);
  });

  it("makes a second holder of an overlapping set wait until the first finishes", async () => {
    const shared = crypto.randomUUID();
    const order: string[] = [];
    const firstRunning = gate();
    const releaseFirst = gate();

    const first = lock.withLock([shared, crypto.randomUUID()], async () => {
      order.push("first:start");
      firstRunning.open();
      await releaseFirst.opened;
      order.push("first:end");
    });
    await firstRunning.opened;

    const second = lock.withLock([crypto.randomUUID(), shared], async () => {
      order.push("second");
    });
    // The second holder is blocked on the first's connection, not running.
    const firstPid = (await holders(shared))[0]?.pid ?? 0;
    const blocked = await waitFor(async () => {
      const rows = await db.execute<{ waiting: number }>(
        sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
             WHERE ${firstPid}::int = ANY(pg_blocking_pids(pid))`,
      );
      return (rows.rows[0]?.waiting ?? 0) > 0;
    });
    expect(blocked).toBe(true);
    expect(order).toEqual(["first:start"]);

    releaseFirst.open();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
    expect(await holders(shared)).toEqual([]);
  });

  it("releases every lock when fn throws, so the next holder gets them at once", async () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    await expect(
      lock.withLock(ids, async () => {
        expect(await holders(ids[0] as string)).toHaveLength(1);
        throw new Error("zoho down");
      }),
    ).rejects.toThrow("zoho down");

    for (const id of ids) expect(await holders(id)).toEqual([]);
    const next = await Promise.race([
      lock.withLock(ids, async () => "acquired"),
      new Promise((resolve) => setTimeout(() => resolve("timed out"), 5_000)),
    ]);
    expect(next).toBe("acquired");
  });

  it("survives the server dropping the held connection while fn runs", async () => {
    const id = crypto.randomUUID();
    const result = await lock.withLock([id], async () => {
      const pid = (await holders(id))[0]?.pid ?? 0;
      await db.execute(sql`SELECT pg_terminate_backend(${pid}::int)`);
      // Give the dropped socket time to emit its 'error' while we still hold the client.
      await waitFor(async () => (await holders(id)).length === 0);
      return "done";
    });
    expect(result).toBe("done");
    expect(await holders(id)).toEqual([]);
    expect(await lock.withLock([id], async () => "again")).toBe("again");
  });
});
