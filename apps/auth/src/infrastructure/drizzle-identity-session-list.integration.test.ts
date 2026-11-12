import { randomUUID } from "node:crypto";
import { createIdentityDb } from "@auction/identity-db";
import {
  oauthAccessToken,
  oauthApplication,
  session,
  sessionLineage,
  user,
} from "@auction/identity-db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleIdentitySessionRepository } from "./drizzle-identity-session-repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const run = randomUUID().slice(0, 8);
const ANN = `sd4-${run}-ann`;
const BEN = `sd4-${run}-ben`;
const BID = `sd4-${run}-bid`;
const SHOP = `sd4-${run}-shop`;
const DAY = 86_400_000;

describe.skipIf(!DATABASE_URL)("the device list's data, against Postgres", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const database = db as NonNullable<typeof db>;
  const repository = new DrizzleIdentitySessionRepository(database);
  const now = new Date();

  async function record(
    id: string,
    userId: string,
    extra: Partial<typeof session.$inferInsert> = {},
  ) {
    await database.insert(session).values({
      id,
      token: `tok-${id}`,
      userId,
      expiresAt: new Date(now.getTime() + DAY),
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
  }

  async function token(
    id: string,
    userId: string,
    clientId: string,
    sid: string | null,
    refreshExpiresAt = new Date(now.getTime() + 30 * DAY),
  ) {
    await database.insert(oauthAccessToken).values({
      id,
      accessToken: `access-${id}`,
      refreshToken: `refresh-${id}`,
      accessTokenExpiresAt: new Date(now.getTime() + 600_000),
      refreshTokenExpiresAt: refreshExpiresAt,
      clientId,
      userId,
      scopes: "openid",
      sid,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function clear() {
    await database.delete(oauthAccessToken).where(inArray(oauthAccessToken.userId, [ANN, BEN]));
    await database.delete(session).where(inArray(session.userId, [ANN, BEN]));
  }

  beforeAll(async () => {
    await database.insert(user).values(
      [ANN, BEN].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await database.insert(oauthApplication).values(
      [BID, SHOP].map((clientId) => ({
        id: `${clientId}-app`,
        name: clientId,
        clientId,
        redirectUrls: "https://example.test/callback",
        type: "web",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });
  beforeEach(clear);
  afterAll(async () => {
    await clear();
    await database.delete(oauthApplication).where(inArray(oauthApplication.clientId, [BID, SHOP]));
    await database.delete(user).where(inArray(user.id, [ANN, BEN]));
  });

  it("returns the browser's first sign-in, last use and country", async () => {
    const signedInAt = new Date(now.getTime() - 3 * DAY);
    const lastSeenAt = new Date(now.getTime() - 60_000);
    await record(`${ANN}-a`, ANN, { signedInAt, lastSeenAt, country: "GB" });
    await record(`${ANN}-old`, ANN);
    const rows = await repository.listForSubject(ANN);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(`${ANN}-a`)).toMatchObject({ signedInAt, lastSeenAt, country: "GB" });
    expect(byId.get(`${ANN}-old`)).toMatchObject({
      signedInAt: null,
      lastSeenAt: null,
      country: null,
      clientIds: [],
    });
  });

  it("names the products with live tokens under the sign-in or an earlier name of it", async () => {
    await record(`${ANN}-a`, ANN);
    await record(`${ANN}-b`, ANN);
    await database
      .insert(sessionLineage)
      .values({ previousSid: `${ANN}-a-earlier`, sessionId: `${ANN}-a`, userId: ANN });
    await token(`${ANN}-t1`, ANN, BID, `${ANN}-a`);
    await token(`${ANN}-t2`, ANN, SHOP, `${ANN}-a-earlier`);
    await token(`${ANN}-t3`, ANN, SHOP, `${ANN}-b`);
    const rows = await repository.listForSubject(ANN);
    const clients = (id: string) =>
      [...(rows.find((row) => row.id === id)?.clientIds ?? [])].sort();
    expect(clients(`${ANN}-a`)).toEqual([BID, SHOP].sort());
    expect(clients(`${ANN}-b`)).toEqual([SHOP]);
  });

  it("ignores tokens that have expired or carry no sign-in", async () => {
    await record(`${ANN}-a`, ANN);
    await token(`${ANN}-t1`, ANN, BID, `${ANN}-a`, new Date(now.getTime() - 1_000));
    await token(`${ANN}-t2`, ANN, SHOP, null);
    const [row] = await repository.listForSubject(ANN);
    expect(row?.clientIds).toEqual([]);
  });

  it("never shows another person's sign-ins or the products they use", async () => {
    await record(`${ANN}-a`, ANN, { country: "GB" });
    await record(`${BEN}-a`, BEN, { country: "FR" });
    await token(`${BEN}-t1`, BEN, BID, `${BEN}-a`);
    // Even a token that names Ann's sign-in does not count when it belongs to Ben.
    await token(`${BEN}-t2`, BEN, SHOP, `${ANN}-a`);
    const rows = await repository.listForSubject(ANN);
    expect(rows.map((row) => row.id)).toEqual([`${ANN}-a`]);
    expect(rows[0]?.clientIds).toEqual([]);
    expect(rows[0]?.country).toBe("GB");
  });
});
