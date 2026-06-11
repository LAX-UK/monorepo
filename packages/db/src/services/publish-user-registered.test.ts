import { describe, expect, it, vi } from "vitest";
import { publishUserRegistered } from "./publish-user-registered.js";

function buildEventDb(
  existingRows: Array<{ id: number }>,
  insertedRows: Array<{ id: number }> = [{ id: 99 }],
) {
  const limit = vi.fn().mockResolvedValue(existingRows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const returning = vi.fn().mockResolvedValue(insertedRows);
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn().mockReturnValue({ values });
  return { db: { select, insert } as never, insert, values, onConflictDoNothing, returning };
}

function buildAccountDb(rows: Array<{ providerId: string }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select } as never;
}

describe("publishUserRegistered", () => {
  it("inserts user.registered with credential source when no account row exists", async () => {
    const { db, insert, values } = buildEventDb([]);
    const accountDb = buildAccountDb([]);

    const result = await publishUserRegistered(
      db,
      { userId: "user-1", email: "a@b.com", name: "A B" },
      { producer: "apps/api", accountDb },
    );

    expect(result).toEqual({ inserted: true });
    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "user",
        aggregateId: "user-1",
        eventType: "user.registered",
        producer: "apps/api",
        payload: expect.objectContaining({
          userId: "user-1",
          email: "a@b.com",
          name: "A B",
          source: "credential",
        }),
      }),
    );
  });

  it("resolves google source from the account table", async () => {
    const { db, values } = buildEventDb([]);
    const accountDb = buildAccountDb([{ providerId: "google" }]);

    await publishUserRegistered(
      db,
      { userId: "user-2", email: "g@b.com", name: "G B" },
      { producer: "apps/auth", accountDb },
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ source: "google" }),
      }),
    );
  });

  it("honours an explicit backfill source without reading account", async () => {
    const { db, values } = buildEventDb([]);
    const accountDb = buildAccountDb([{ providerId: "google" }]);

    await publishUserRegistered(
      db,
      { userId: "user-3", email: "x@b.com", name: "X B" },
      { producer: "ops/backfill-brevo", source: "backfill", accountDb },
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ source: "backfill" }),
      }),
    );
  });

  it("is idempotent — skips insert when the event already exists", async () => {
    const { db, insert } = buildEventDb([{ id: 7 }]);
    const accountDb = buildAccountDb([]);

    const result = await publishUserRegistered(
      db,
      { userId: "user-1", email: "a@b.com", name: "A B" },
      { producer: "apps/api", accountDb },
    );

    expect(result).toEqual({ inserted: false });
    expect(insert).not.toHaveBeenCalled();
  });
});
