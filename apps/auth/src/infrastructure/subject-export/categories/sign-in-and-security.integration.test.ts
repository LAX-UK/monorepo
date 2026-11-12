import { randomUUID } from "node:crypto";
import { createIdentityDb } from "@auction/identity-db";
import {
  oauthAccessToken,
  oauthApplication,
  session,
  sessionLineage,
  user,
} from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleSessionClientsReader } from "../../drizzle-session-clients.reader.js";
import { SignInAndSecurityExportCategory } from "./sign-in-and-security.category.js";

const DATABASE_URL = process.env.DATABASE_URL;
const run = randomUUID().slice(0, 8);
const ANN = `sd5-${run}-ann`;
const BEN = `sd5-${run}-ben`;
const LAPTOP = `sd5-${run}-laptop`;
const OLD_LAPTOP = `sd5-${run}-laptop-before`;
const PHONE = `sd5-${run}-phone`;
const BENS = `sd5-${run}-bens`;
const CLIENTS = ["lax-account-web", "lax-bid-web", "lax-shop-web", "lax-art-web", "lax-shop-admin"];
const now = new Date("2026-11-12T10:00:00.000Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe.skipIf(!DATABASE_URL)("sign-in and security export: devices", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;

  async function token(sid: string, userId: string, clientId: string, n: number) {
    await db?.insert(oauthAccessToken).values({
      id: `sd5-${run}-t${n}`,
      accessToken: `sd5-${run}-access-${n}`,
      refreshToken: `sd5-${run}-refresh-${n}`,
      accessTokenExpiresAt: day(-1),
      refreshTokenExpiresAt: day(-30),
      sid,
      clientId,
      userId,
      scopes: "openid",
      createdAt: now,
      updatedAt: now,
    });
  }

  beforeAll(async () => {
    if (!db) return;
    await db.insert(user).values(
      [ANN, BEN].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await db
      .insert(oauthApplication)
      .values(
        CLIENTS.map((clientId) => ({
          id: `app-${clientId}`,
          name: clientId,
          clientId,
          redirectUrls: "https://example.test/callback",
          type: "web",
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
    const base = { expiresAt: day(-7), createdAt: day(5), updatedAt: day(1) };
    await db.insert(session).values([
      {
        ...base,
        id: LAPTOP,
        token: `tok-${LAPTOP}`,
        userId: ANN,
        userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit Chrome/130 Safari/537",
        country: "GB",
        lastSeenAt: day(1),
      },
      { ...base, id: PHONE, token: `tok-${PHONE}`, userId: ANN },
      { ...base, id: BENS, token: `tok-${BENS}`, userId: BEN, country: "FR" },
    ]);
    // The laptop's sign-in took over an earlier one that Bid still names in its tokens.
    await db.insert(sessionLineage).values({
      previousSid: OLD_LAPTOP,
      sessionId: LAPTOP,
      userId: ANN,
      createdAt: day(2),
    });
    await token(LAPTOP, ANN, "lax-account-web", 1);
    await token(OLD_LAPTOP, ANN, "lax-bid-web", 2);
    await token(LAPTOP, ANN, "lax-shop-admin", 3);
    await token(BENS, BEN, "lax-art-web", 4);
    // Ben's token carrying Ann's laptop sid: the person filter, not the sid, keeps it out.
    await token(LAPTOP, BEN, "lax-shop-web", 5);
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(user).where(eq(user.id, ANN));
    await db.delete(user).where(eq(user.id, BEN));
  });

  async function sessionsOf(subjectId: string) {
    if (!db) return [];
    const page = await new SignInAndSecurityExportCategory(
      db,
      () => now,
      null,
      createDrizzleSessionClientsReader(db),
    ).readPage(subjectId, null);
    return page.records.filter((record) => record.kind === "session");
  }

  it("names the country, the products used and when each browser was last active", async () => {
    const records = await sessionsOf(ANN);
    const laptop = records.find((record) => record.id === LAPTOP);
    expect(laptop).toMatchObject({
      device: "Chrome on macOS",
      country: "GB",
      products: ["LAX Account", "LAX Bid"],
      lastActiveAt: day(1).toISOString(),
    });
  });

  it("leaves out staff clients and reports empty facts for a record made before they were kept", async () => {
    const phone = (await sessionsOf(ANN)).find((record) => record.id === PHONE);
    expect(phone).toMatchObject({ country: null, products: [], lastActiveAt: null });
  });

  it("never shows another person's browsers or products", async () => {
    const records = await sessionsOf(ANN);
    expect(records.map((record) => record.id).sort()).toEqual([LAPTOP, PHONE].sort());
    expect(JSON.stringify(records)).not.toContain("lax-art");
    expect(await sessionsOf(BEN)).toEqual([
      expect.objectContaining({ id: BENS, country: "FR", products: ["lax.art"] }),
    ]);
  });

  it("never puts a token value, or a token row's id, in the file", async () => {
    if (!db) return;
    const page = await new SignInAndSecurityExportCategory(
      db,
      () => now,
      null,
      createDrizzleSessionClientsReader(db),
    ).readPage(ANN, null);
    const text = JSON.stringify(page);
    expect(text).not.toContain(`sd5-${run}-access-`);
    expect(text).not.toContain(`sd5-${run}-refresh-`);
    expect(text).not.toContain(`sd5-${run}-t`);
  });
});
