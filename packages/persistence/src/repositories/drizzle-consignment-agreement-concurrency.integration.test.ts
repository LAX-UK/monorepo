import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { consignmentAgreement, itemSubmission, legalEntity, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgreementSupersededError, supersedeAgreement } from "./agreement-version.js";
import { DrizzleConsignmentAgreementRepository } from "./drizzle-consignment-agreement.repository.js";
import { DrizzleSignedAgreementWriter } from "./drizzle-signed-agreement.writer.js";

const url = process.env.DATABASE_URL;

/** True when the promise has not settled within the time: it is waiting on a lock. */
async function stillWaiting(promise: Promise<unknown>, ms = 400): Promise<boolean> {
  const marker = Symbol("waiting");
  const winner = await Promise.race([
    promise.then(
      () => null,
      () => null,
    ),
    new Promise((resolve) => setTimeout(() => resolve(marker), ms)),
  ]);
  return winner === marker;
}

/**
 * A reader that waits on a row lock while another connection supersedes that row must still land
 * on the successor, not match nothing. Two connections, committed rows, removed afterwards.
 */
describe.skipIf(!url)("current agreement under a concurrent correction (Postgres)", () => {
  const a = createDb(url as string);
  const b = createDb(url as string);
  const tag = randomUUID().slice(0, 8);
  const userId = `agreement-cc-${tag}`;
  const entityId = randomUUID();
  const submissionIds: string[] = [];

  beforeAll(async () => {
    const now = new Date();
    await a.insert(user).values({
      id: userId,
      name: "Fixture",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await a.insert(legalEntity).values({
      id: entityId,
      displayName: `Fixture ${tag}`,
      kind: "organisation",
      subkind: "gallery",
      primaryCountry: "GB",
      createdByUserId: userId,
    } as typeof legalEntity.$inferInsert);
  });

  afterAll(async () => {
    for (const id of submissionIds) await a.delete(itemSubmission).where(eq(itemSubmission.id, id));
    await a.delete(legalEntity).where(eq(legalEntity.id, entityId));
    await a.delete(user).where(eq(user.id, userId));
  });

  async function signed() {
    const submissionId = randomUUID();
    submissionIds.push(submissionId);
    await a
      .insert(itemSubmission)
      .values({ id: submissionId, legalEntityId: entityId, title: "Work", status: "approved" });
    const [v1] = await a
      .insert(consignmentAgreement)
      .values({
        submissionId,
        legalEntityId: entityId,
        termsVersion: "v1",
        commissionPercent: "12.00",
        acceptedAt: new Date("2026-10-03T10:00:00Z"),
        acceptedByUserId: userId,
      })
      .returning();
    if (!v1) throw new Error("seed failed");
    return { submissionId, v1 };
  }

  /**
   * Connection A supersedes `v1` and holds its transaction open; `reader` starts on connection B
   * and blocks on the lock; A then commits. Returns what B's statement made of it.
   */
  async function raceCorrection<T>(
    seed: Awaited<ReturnType<typeof signed>>,
    reader: (db: Database) => Promise<T>,
  ): Promise<T> {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let superseded: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      superseded = resolve;
    });
    const correction = a.transaction(async (tx) => {
      await tx
        .select()
        .from(consignmentAgreement)
        .where(eq(consignmentAgreement.id, seed.v1.id))
        .for("update");
      await supersedeAgreement(tx, seed.v1, { commissionPercent: "15.00" }, new Date());
      superseded();
      await held;
    });
    await ready;
    const read = reader(b);
    expect(await stillWaiting(read)).toBe(true);
    release();
    await correction;
    return read;
  }

  it("sets the relist floor on the version that replaced the one it waited for", async () => {
    const seed = await signed();
    const repo = (db: Database) => new DrizzleConsignmentAgreementRepository(db);
    const result = await raceCorrection(seed, (db) =>
      repo(db).setRelistReserveFloor(seed.submissionId, "750.00", new Date()),
    );
    expect(result).toMatchObject({ commissionPercent: "15.00", relistReserveFloor: "750.00" });
    const rows = await a
      .select()
      .from(consignmentAgreement)
      .where(eq(consignmentAgreement.submissionId, seed.submissionId));
    expect(rows.find((r) => r.supersededAt === null)?.relistReserveFloor).toBe("750.00");
  });

  it("locks the version that replaced the one it waited for", async () => {
    const seed = await signed();
    const locked = await raceCorrection(seed, (db) =>
      db.transaction((tx) =>
        new DrizzleSignedAgreementWriter(tx as unknown as Database).lockAgreement(
          seed.submissionId,
        ),
      ),
    );
    expect(locked).not.toBeNull();
    expect(locked?.id).not.toBe(seed.v1.id);
    expect(locked?.commissionPercent).toBe("15.00");
  });

  it("still reports no agreement for a consignment that has none", async () => {
    const submissionId = randomUUID();
    submissionIds.push(submissionId);
    await a
      .insert(itemSubmission)
      .values({ id: submissionId, legalEntityId: entityId, title: "Bare", status: "approved" });
    expect(await new DrizzleSignedAgreementWriter(a).lockAgreement(submissionId)).toBeNull();
    expect(
      await new DrizzleConsignmentAgreementRepository(a).setRelistReserveFloor(
        submissionId,
        "1.00",
        new Date(),
      ),
    ).toBeNull();
  });

  it("refuses to supersede a version that is no longer current, with a typed error", async () => {
    const seed = await signed();
    await a.transaction((tx) =>
      supersedeAgreement(tx, seed.v1, { commissionPercent: "15.00" }, new Date()),
    );
    await expect(
      a.transaction((tx) =>
        supersedeAgreement(tx, seed.v1, { commissionPercent: "20.00" }, new Date()),
      ),
    ).rejects.toBeInstanceOf(AgreementSupersededError);
  });
});
