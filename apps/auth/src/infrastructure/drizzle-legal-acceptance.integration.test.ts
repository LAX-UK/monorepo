import { LEGAL_DOCUMENT_SETS } from "@auction/identity-contracts";
import { createIdentityDb } from "@auction/identity-db";
import { subjectLegalAcceptance, user } from "@auction/identity-db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleLegalAcceptanceRecorder } from "./drizzle-legal-acceptance.recorder.js";
import { ConsentsExportCategory } from "./subject-export/categories/consents.category.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("sign-up legal acceptance", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const userId = "90000000-0000-4000-8000-000000000071";
  const now = new Date();

  async function clean() {
    if (!db) return;
    await db.delete(subjectLegalAcceptance).where(eq(subjectLegalAcceptance.subjectId, userId));
    await db.delete(user).where(eq(user.id, userId));
  }

  beforeEach(async () => {
    if (!db) return;
    await clean();
    await db.insert(user).values({
      id: userId,
      name: "Acceptance Test",
      email: "legal-acceptance-test@lax.bid",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(clean);

  const rowsFor = () =>
    db
      ? db.select().from(subjectLegalAcceptance).where(eq(subjectLegalAcceptance.subjectId, userId))
      : Promise.resolve([]);

  it("writes the Terms and the Privacy notice of the company whose documents were shown", async () => {
    if (!db) return;
    await new DrizzleLegalAcceptanceRecorder(db).recordSignUp({
      subjectId: userId,
      product: "shop",
      source: "hosted_sign_up",
    });
    const rows = await rowsFor();
    expect(rows.map((row) => row.documentKind).sort()).toEqual(["privacy", "terms"]);
    for (const row of rows) {
      expect(row.legalEntity).toBe("london-art-exchange");
      expect(row.product).toBe("shop");
      expect(row.source).toBe("hosted_sign_up");
    }
    const terms = rows.find((row) => row.documentKind === "terms");
    expect(terms?.documentVersion).toBe(LEGAL_DOCUMENT_SETS["london-art-exchange"].terms.version);
  });

  it("records a social sign-up and adds nothing when the same call repeats", async () => {
    if (!db) return;
    const recorder = new DrizzleLegalAcceptanceRecorder(db);
    const input = { subjectId: userId, product: "bid", source: "social_sign_up" } as const;
    await recorder.recordSignUp(input);
    await recorder.recordSignUp(input);
    const rows = await rowsFor();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.source))).toEqual(new Set(["social_sign_up"]));
    expect(new Set(rows.map((row) => row.legalEntity))).toEqual(
      new Set(["london-auction-xchange"]),
    );
  });

  it("keeps a record when the account's personal details are erased", async () => {
    if (!db) return;
    await new DrizzleLegalAcceptanceRecorder(db).recordSignUp({
      subjectId: userId,
      product: "account",
      source: "hosted_sign_up",
    });
    await db.execute(sql`SELECT user_pii_purge(${userId})`);
    expect(await rowsFor()).toHaveLength(2);
  });

  it("appears in the person's data download", async () => {
    if (!db) return;
    await new DrizzleLegalAcceptanceRecorder(db).recordSignUp({
      subjectId: userId,
      product: "art",
      source: "hosted_sign_up",
    });
    const category = new ConsentsExportCategory(db);
    expect(await category.count(userId)).toBe(2);
    const page = await category.readPage(userId, null);
    expect(page.records).toHaveLength(2);
    const terms = page.records.find((record) => record.kind === "terms");
    expect(terms).toMatchObject({
      origin: "provided",
      choice: "accepted",
      product: "lax.art",
      company: "London Art Exchange Ltd",
      version: LEGAL_DOCUMENT_SETS["london-art-exchange"].terms.version,
    });
    expect(JSON.stringify(page.records)).not.toContain(userId);
  });
});
