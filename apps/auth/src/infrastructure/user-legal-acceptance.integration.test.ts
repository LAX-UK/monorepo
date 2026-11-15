import { randomUUID } from "node:crypto";
import { type AuthPorts, createAuth } from "@auction/auth";
import { createIdentityAuthPorts, createIdentityDb } from "@auction/identity-db";
import { subjectLegalAcceptance, user } from "@auction/identity-db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDrizzleDatabase } from "./build-drizzle-database.js";

/**
 * The account and the record of the Terms it accepted are written in one transaction. The failure
 * is forced in the database itself (a trigger that refuses the record), so the test covers the real
 * rollback and not a stubbed call.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = "http://localhost:3001";
const PASSWORD = `Pw-${randomUUID()}`;
const TRIGGER = "test_refuse_legal_acceptance";

describe.skipIf(!DATABASE_URL)("sign-up writes the account and its Terms record together", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const emails: string[] = [];

  function buildAuth() {
    if (!db) throw new Error("DATABASE_URL is required");
    const ports: AuthPorts = {
      ...createIdentityAuthPorts(db),
      email: undefined,
      securityNotices: { notify: async () => undefined },
      sms: undefined,
      events: undefined,
      credentialEmail: { send: async () => undefined },
    };
    return createAuth({
      database: buildDrizzleDatabase(db),
      ports,
      secret: "atomic-terms-consent-test-secret-0123456789",
      baseURL: BASE_URL,
      issuerURL: BASE_URL,
      allowInsecureCookies: true,
    });
  }

  async function signUp(extra: Record<string, unknown>) {
    const email = `atomic-${randomUUID()}@example.test`;
    emails.push(email);
    const response = await buildAuth().handler(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ name: "Atomic Test", email, password: PASSWORD, ...extra }),
      }),
    );
    return { email, response };
  }

  async function userByEmail(email: string) {
    if (!db) throw new Error("DATABASE_URL is required");
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    return row;
  }

  async function recordsFor(userId: string) {
    if (!db) throw new Error("DATABASE_URL is required");
    return db
      .select({
        kind: subjectLegalAcceptance.documentKind,
        version: subjectLegalAcceptance.documentVersion,
        product: subjectLegalAcceptance.product,
        source: subjectLegalAcceptance.source,
        acceptedAt: subjectLegalAcceptance.acceptedAt,
      })
      .from(subjectLegalAcceptance)
      .where(eq(subjectLegalAcceptance.subjectId, userId));
  }

  beforeAll(async () => {
    if (!db) return;
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${TRIGGER} ON subject_legal_acceptance`));
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${TRIGGER} ON subject_legal_acceptance`));
    await db.execute(sql.raw("DROP FUNCTION IF EXISTS test_refuse_legal_acceptance_fn()"));
    if (emails.length === 0) return;
    const rows = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails));
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return;
    // The record is kept when an account is erased, so the test removes it first.
    await db.delete(subjectLegalAcceptance).where(inArray(subjectLegalAcceptance.subjectId, ids));
    await db.delete(user).where(inArray(user.id, ids));
  });

  it("writes the user and both documents when the sign-up page showed them", async () => {
    const { email, response } = await signUp({ legalAcceptance: { product: "bid" } });
    expect(response.status).toBe(200);
    const created = await userByEmail(email);
    expect(created).toBeDefined();
    const records = await recordsFor(created?.id ?? "");
    expect(records.map((r) => r.kind).sort()).toEqual(["privacy", "terms"]);
    for (const record of records) {
      expect(record.product).toBe("bid");
      expect(record.source).toBe("hosted_sign_up");
      expect(record.version).toBeTruthy();
      expect(record.acceptedAt).toBeInstanceOf(Date);
    }
  });

  it("stores no record, and claims none, for a sign-up that showed no statement", async () => {
    const { email, response } = await signUp({});
    expect(response.status).toBe(200);
    const created = await userByEmail(email);
    expect(created).toBeDefined();
    expect(await recordsFor(created?.id ?? "")).toEqual([]);
  });

  it("leaves no user row when the record cannot be written", async () => {
    if (!db) throw new Error("DATABASE_URL is required");
    await db.execute(
      sql.raw(`CREATE OR REPLACE FUNCTION test_refuse_legal_acceptance_fn() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'forced consent insert failure'; END; $$ LANGUAGE plpgsql`),
    );
    await db.execute(
      sql.raw(`CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON subject_legal_acceptance
        FOR EACH ROW EXECUTE FUNCTION test_refuse_legal_acceptance_fn()`),
    );
    try {
      const { email, response } = await signUp({ legalAcceptance: { product: "account" } });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await userByEmail(email)).toBeUndefined();
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${TRIGGER} ON subject_legal_acceptance`));
    }
  });
});
