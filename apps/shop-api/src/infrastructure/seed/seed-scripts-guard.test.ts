import { readFileSync } from "node:fs";
import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { seedAcceptancePortal, seedAcceptanceStaffOperations } from "./acceptance-seed-target.js";
import { runShopDemoFull } from "./demo-full-runner.js";
import { grantLocalAdminStaff } from "./local-admin-staff-seed.js";
import { seedReleaseAlertSendFixtures } from "./release-alert-sends-seed.js";
import { seedZohoMirrorBadgeFixtures } from "./zoho-mirror-badge-seed.js";

/**
 * Each Shop seed script that writes staff grants or demo data runs one of these functions, which
 * check the demo seed mark first. The writers are replaced by spies, so taking the guard out of a
 * function fails here; the wiring tests below fail if a script stops using the guarded function.
 */

const LOCAL_URL = "postgresql://shop_app:p@localhost:5432/auction_ci";
const REMOTE_URL = "postgresql://shop_app:p@db-test-lon1.example.com:25060/defaultdb";

/** current_database() is `name`; `mark` is the demo_seed_target row, if any. */
function fakeDb(mark?: { environment: string; database_name: string }) {
  const statements: string[] = [];
  const db = {
    async execute(query: { queryChunks?: unknown[] }) {
      const text = JSON.stringify(query.queryChunks ?? query);
      statements.push(text);
      if (text.includes("to_regclass")) return { rows: [{ name: "auction_ci", has_table: true }] };
      if (text.includes("from demo_seed_target")) return { rows: mark ? [mark] : [] };
      return { rows: [] };
    },
  };
  return db as unknown as Database;
}

const LOCAL_MARK = { environment: "local", database_name: "auction_ci" };
const TEST_MARK = { environment: "test", database_name: "auction_ci" };

type Case = {
  name: string;
  run: (db: Database, url: string, write: ReturnType<typeof vi.fn>) => Promise<unknown>;
};

const CASES: Case[] = [
  {
    name: "seed:acceptance-portal",
    run: (db, url, write) =>
      seedAcceptancePortal(
        db,
        url,
        vi.fn() as never,
        { identitySubjectId: "s" },
        { DATABASE_URL_SHOP: url },
        write as never,
      ),
  },
  {
    name: "seed:acceptance-staff-operations",
    run: (db, url, write) =>
      seedAcceptanceStaffOperations(
        db,
        url,
        { adminStaffSubjectId: "s" },
        { DATABASE_URL_SHOP: url },
        write as never,
      ),
  },
  {
    name: "seed:demo-full",
    run: (db, url, write) =>
      runShopDemoFull(
        db,
        { databaseUrl: url },
        { full: write as never, queues: write as never, states: write as never },
      ),
  },
  {
    name: "seed:local-admin-staff",
    run: (db, url, write) =>
      grantLocalAdminStaff(
        db,
        { databaseUrl: url },
        new Map([
          ["admin@lax.bid", "a"],
          ["staff-catalogue@lax.bid", "b"],
          ["staff-operations@lax.bid", "c"],
          ["accountant@lax.bid", "d"],
          ["staff-advisor@lax.bid", "e"],
          ["gallery-admin@lax.bid", "f"],
        ]),
        write as never,
      ),
  },
  {
    name: "seed:zoho-mirror-badge",
    // Its writes run in transactions; the spy stands for them.
    run: (db, url, write) =>
      seedZohoMirrorBadgeFixtures(
        Object.assign(db, {
          transaction: async () => {
            write();
          },
        }),
        { databaseUrl: url },
      ),
  },
  {
    name: "seed:release-alert-sends",
    run: (db, url, write) =>
      seedReleaseAlertSendFixtures(db, { databaseUrl: url }, new Date(), async () => {
        write();
        return { created: [] };
      }),
  },
];

describe.each(CASES)("$name", ({ name, run }) => {
  it("writes nothing on an unmarked database, even at a loopback address", async () => {
    for (const url of [LOCAL_URL, REMOTE_URL]) {
      const write = vi.fn(async () => ({}));
      await expect(run(fakeDb(), url, write)).rejects.toThrow(/not marked/);
      expect(write).not.toHaveBeenCalled();
    }
  });

  it("writes nothing on a production address", async () => {
    const write = vi.fn(async () => ({}));
    await expect(
      run(fakeDb(TEST_MARK), "postgresql://u:p@lax-prod-db.example.com/x", write),
    ).rejects.toThrow(/production/);
    expect(write).not.toHaveBeenCalled();
  });

  it("writes on a marked local database", async () => {
    const write = vi.fn(async () => ({}));
    await run(fakeDb(LOCAL_MARK), LOCAL_URL, write);
    expect(write).toHaveBeenCalled();
  });

  if (
    name === "seed:local-admin-staff" ||
    name === "seed:zoho-mirror-badge" ||
    name === "seed:release-alert-sends"
  ) {
    it("writes nothing on a database marked test, even through a loopback tunnel", async () => {
      const write = vi.fn(async () => ({}));
      await expect(run(fakeDb(TEST_MARK), LOCAL_URL, write)).rejects.toThrow(/marked "test"/);
      expect(write).not.toHaveBeenCalled();
    });
  }
});

describe("Shop seed script wiring", () => {
  const read = (file: string) =>
    readFileSync(new URL(`../../scripts/${file}`, import.meta.url), "utf8");

  it.each([
    ["seed-acceptance-portal.ts", "seedAcceptancePortal(", "seedAcceptancePortalFixtures"],
    [
      "seed-acceptance-staff-operations.ts",
      "seedAcceptanceStaffOperations(",
      "seedAcceptanceStaffOperationsFixtures",
    ],
    ["seed-demo-full.ts", "runShopDemoFull(", "seedDemoStaffQueues"],
    ["seed-demo-full.ts", "runShopDemoFull(", "seedDemoShopStates"],
    ["seed-demo-full.ts", "runShopDemoFull(", "seedDemoFull("],
    ["seed-local-admin-staff.ts", "grantLocalAdminStaff(", "grantShopStaffRole"],
    ["seed-zoho-mirror-badge.ts", "seedZohoMirrorBadgeFixtures(", "INSERT INTO"],
    ["seed-release-alert-sends.ts", "seedReleaseAlertSendFixtures(", "INSERT INTO"],
  ])("%s goes through the guarded function", (file, guarded, raw) => {
    const source = read(file);
    expect(source).toContain(guarded);
    expect(source).not.toContain(raw);
  });
});
