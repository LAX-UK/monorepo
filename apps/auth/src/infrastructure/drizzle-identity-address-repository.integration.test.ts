import type { AccountAddressFields } from "@auction/identity-contracts";
import { createIdentityDb } from "@auction/identity-db";
import { identityAddress, user } from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleIdentityAddressRepository } from "./drizzle-identity-address-repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const ANN = "address-it-ann";
const BOB = "address-it-bob";

const fields = (label: string): AccountAddressFields => ({
  label,
  recipientName: "Ann Buyer",
  line1: "1 High Street",
  line2: null,
  city: "London",
  region: null,
  postcode: "SW1A 1AA",
  country: "GB",
  phone: null,
});

describe.skipIf(!DATABASE_URL)("drizzle identity address repository", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const repository = db ? new DrizzleIdentityAddressRepository(db) : undefined;

  beforeAll(async () => {
    if (!db) return;
    const now = new Date();
    await db
      .insert(user)
      .values(
        [ANN, BOB].map((id) => ({
          id,
          name: id,
          email: `${id}@example.test`,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(identityAddress).where(inArray(identityAddress.subjectId, [ANN, BOB]));
    await db.delete(user).where(inArray(user.id, [ANN, BOB]));
  });

  async function reset() {
    await db?.delete(identityAddress).where(inArray(identityAddress.subjectId, [ANN, BOB]));
  }

  it("makes the first address both defaults and the next ones plain", async () => {
    if (!repository) return;
    await reset();
    const first = await repository.create(ANN, fields("Home"), 20);
    const second = await repository.create(ANN, fields("Work"), 20);
    expect(first).toMatchObject({
      ok: true,
      address: { isDefaultShipping: true, isDefaultBilling: true, version: 1 },
    });
    expect(second).toMatchObject({
      ok: true,
      address: { isDefaultShipping: false, isDefaultBilling: false },
    });
  });

  it("refuses an address beyond the limit, even when created at the same moment", async () => {
    if (!repository) return;
    await reset();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) => repository.create(ANN, fields(`A${index}`), 3)),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok)).toEqual(
      Array(3).fill({ ok: false, reason: "address_limit_reached" }),
    );
    expect(await repository.list(ANN)).toHaveLength(3);
  });

  it("moves a default without ever leaving two, and bumps the versions it touches", async () => {
    if (!repository) return;
    await reset();
    await repository.create(ANN, fields("Home"), 20);
    const second = await repository.create(ANN, fields("Work"), 20);
    if (!second.ok) throw new Error("expected create to succeed");
    const moved = await repository.setDefault(ANN, second.address.id, "shipping");
    expect(moved).toMatchObject({
      ok: true,
      address: { isDefaultShipping: true, isDefaultBilling: false, version: 2 },
    });
    const rows = await repository.list(ANN);
    expect(rows.filter((row) => row.isDefaultShipping)).toHaveLength(1);
    expect(rows.filter((row) => row.isDefaultBilling)).toHaveLength(1);
    expect(rows.find((row) => row.label === "Home")).toMatchObject({
      isDefaultShipping: false,
      isDefaultBilling: true,
      version: 2,
    });
  });

  it("refuses a stale update or delete and applies a current one", async () => {
    if (!repository) return;
    await reset();
    const created = await repository.create(ANN, fields("Home"), 20);
    if (!created.ok) throw new Error("expected create to succeed");
    const { id } = created.address;
    expect(await repository.update(ANN, id, 1, { ...fields("Home"), city: "Leeds" })).toMatchObject(
      { ok: true, address: { city: "Leeds", version: 2 } },
    );
    expect(await repository.update(ANN, id, 1, fields("Stale"))).toEqual({
      ok: false,
      reason: "version_conflict",
    });
    expect(await repository.delete(ANN, id, 1)).toEqual({ ok: false, reason: "version_conflict" });
    expect(await repository.delete(ANN, id, 2)).toEqual({ ok: true });
    expect(await repository.list(ANN)).toEqual([]);
  });

  it("promotes the oldest remaining address when a default is deleted", async () => {
    if (!repository) return;
    await reset();
    const home = await repository.create(ANN, fields("Home"), 20);
    await repository.create(ANN, fields("Work"), 20);
    await repository.create(ANN, fields("Cabin"), 20);
    if (!home.ok) throw new Error("expected create to succeed");
    expect(await repository.delete(ANN, home.address.id, 1)).toEqual({ ok: true });
    const rows = await repository.list(ANN);
    expect(rows.map((row) => row.label)).toEqual(["Work", "Cabin"]);
    expect(rows[0]).toMatchObject({ isDefaultShipping: true, isDefaultBilling: true });
    expect(rows[1]).toMatchObject({ isDefaultShipping: false, isDefaultBilling: false });
  });

  it("never lets one person read or change another person's address", async () => {
    if (!repository) return;
    await reset();
    const created = await repository.create(ANN, fields("Home"), 20);
    if (!created.ok) throw new Error("expected create to succeed");
    const { id } = created.address;
    expect(await repository.list(BOB)).toEqual([]);
    expect(await repository.update(BOB, id, 1, fields("Mine now"))).toEqual({
      ok: false,
      reason: "address_not_found",
    });
    expect(await repository.delete(BOB, id, 1)).toEqual({
      ok: false,
      reason: "address_not_found",
    });
    expect(await repository.setDefault(BOB, id, "billing")).toEqual({
      ok: false,
      reason: "address_not_found",
    });
    expect(await db?.select().from(identityAddress).where(eq(identityAddress.id, id))).toHaveLength(
      1,
    );
  });
});
