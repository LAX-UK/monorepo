import { describe, expect, it, vi } from "vitest";
import {
  type MarkDemoTargetClient,
  assertMarkFitsAddress,
  markDemoTarget,
  parseMarkDemoTargetArgs,
} from "./mark-demo-target-cli.js";

describe("parseMarkDemoTargetArgs", () => {
  it("defaults to a local mark by ci", () => {
    expect(parseMarkDemoTargetArgs([])).toEqual({
      environment: "local",
      markedBy: "ci",
      existingLocalDatabase: false,
    });
  });
  it("accepts test and local only", () => {
    expect(parseMarkDemoTargetArgs(["test", "ops"]).environment).toBe("test");
    expect(() => parseMarkDemoTargetArgs(["production"])).toThrow(/"test" or "local"/);
  });
  it("reads --existing-local-database anywhere", () => {
    expect(parseMarkDemoTargetArgs(["local", "--existing-local-database", "me"])).toEqual({
      environment: "local",
      markedBy: "me",
      existingLocalDatabase: true,
    });
  });
});

describe("assertMarkFitsAddress", () => {
  it("refuses to mark a remote or test database local", () => {
    const local = { environment: "local" } as const;
    expect(() =>
      assertMarkFitsAddress(local, {
        databaseUrl: "postgres://u:p@db.example.com:25060/defaultdb",
      }),
    ).toThrow(/only a local database/);
    expect(() =>
      assertMarkFitsAddress(local, { databaseUrl: "postgres://u:p@localhost/x", appEnv: "test" }),
    ).toThrow(/only a local database/);
    expect(() => assertMarkFitsAddress(local, { databaseUrl: "postgres://u:p@dbhost/x" })).toThrow(
      /only a local database/,
    );
    expect(() =>
      assertMarkFitsAddress(local, { databaseUrl: "postgres://u:p@localhost/x" }),
    ).not.toThrow();
    expect(() =>
      assertMarkFitsAddress(
        { environment: "test" },
        { databaseUrl: "postgres://u:p@db.example.com:25060/defaultdb" },
      ),
    ).not.toThrow();
  });
});

function fakeClient(options: { mark?: string; users: number }) {
  const statements: string[] = [];
  const client: MarkDemoTargetClient = {
    query: vi.fn(async (text: string) => {
      statements.push(text);
      if (text.includes("from demo_seed_target")) {
        return { rows: options.mark ? [{ environment: options.mark }] : [], rowCount: 0 };
      }
      if (text.includes('public."user"')) return { rows: [{ count: options.users }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }),
  };
  return { client, inserted: () => statements.some((s) => s.startsWith("insert into")) };
}

describe("markDemoTarget", () => {
  const LOCAL = { databaseUrl: "postgres://u:p@localhost:5432/auction" };
  const args = (existingLocalDatabase = false) =>
    ({ environment: "local", markedBy: "me", existingLocalDatabase }) as const;

  it("marks a fresh local database (no users) local", async () => {
    const { client, inserted } = fakeClient({ users: 0 });
    await expect(markDemoTarget(client, args(), LOCAL)).resolves.toBe("marked");
    expect(inserted()).toBe(true);
  });

  it("refuses to mark an unmarked loopback database with users local (a tunnel?)", async () => {
    const { client, inserted } = fakeClient({ users: 120 });
    await expect(markDemoTarget(client, args(), LOCAL)).rejects.toThrow(
      /already has 120 users.*--existing-local-database/,
    );
    expect(inserted()).toBe(false);
  });

  it("marks an existing local database only when the operator says so", async () => {
    const { client, inserted } = fakeClient({ users: 120 });
    await expect(markDemoTarget(client, args(true), LOCAL)).resolves.toBe("marked");
    expect(inserted()).toBe(true);
  });

  it("leaves an existing mark as it is, whatever was asked", async () => {
    const { client, inserted } = fakeClient({ mark: "test", users: 120 });
    await expect(markDemoTarget(client, args(), LOCAL)).resolves.toBe("already-marked");
    expect(inserted()).toBe(false);
  });

  it("refuses production before touching the database", async () => {
    const { client } = fakeClient({ users: 0 });
    await expect(
      markDemoTarget(
        client,
        { ...args(), environment: "test" },
        { ...LOCAL, appEnv: "production" },
      ),
    ).rejects.toThrow(/production/);
    expect(client.query).not.toHaveBeenCalled();
  });
});
