import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { createDrizzleSessionStampStore } from "./drizzle-session-stamp-store.js";

const AT = new Date("2026-11-09T12:00:00Z");

function recordingDb() {
  const sets: Array<Record<string, unknown>> = [];
  const db = {
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        sets.push(values);
        return { where: vi.fn(async () => undefined) };
      },
    })),
  };
  return { db: db as never, sets };
}

const dialect = new PgDialect();
const sqlOf = (value: unknown) => dialect.sqlToQuery(value as never);

describe("session stamps record how the session was signed in", () => {
  it("adds 'password' once to a password sign-in's session", async () => {
    const { db, sets } = recordingDb();
    await createDrizzleSessionStampStore(db).stampPasswordAuth("token", AT);
    const { sql, params } = sqlOf(sets[0]?.amr);
    expect(sql).toContain("array_append");
    expect(sql).toContain("= ANY(");
    expect(params).toEqual(["password", "password"]);
    expect(sets[0]).toMatchObject({ lastPasswordAuthAt: AT });
  });

  it("adds 'provider' once to a Google or Apple sign-in's session", async () => {
    const { db, sets } = recordingDb();
    await createDrizzleSessionStampStore(db).stampSocialAuth("token", AT);
    expect(sqlOf(sets[0]?.amr).params).toEqual(["provider", "provider"]);
    expect(sets[0]).toMatchObject({ socialAuthAt: AT });
  });

  it("leaves how the session was signed in alone when two-step completes", async () => {
    const { db, sets } = recordingDb();
    await createDrizzleSessionStampStore(db).stampMfaCompleted("token", AT);
    expect(sets[0]).not.toHaveProperty("amr");
    expect(sets[0]).toMatchObject({ mfaCompletedAt: AT });
  });
});
