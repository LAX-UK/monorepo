import { describe, expect, it, vi } from "vitest";
import { publishUserRegistered } from "./publish-user-registered.js";

describe("publishUserRegistered", () => {
  it("inserts user.registered with credential source when no account row exists", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = {
      select,
      insert,
    } as unknown as import("@auction/db").Database;

    await publishUserRegistered(db, {
      userId: "user-1",
      email: "a@example.com",
      name: "Alice",
    });

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "user",
        aggregateId: "user-1",
        eventType: "user.registered",
        producer: "apps/auth",
        payload: {
          userId: "user-1",
          email: "a@example.com",
          name: "Alice",
          source: "credential",
        },
        actorUserId: null,
        schemaVersion: 1,
      }),
    );
  });

  it("maps google provider to google source", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const limit = vi.fn().mockResolvedValue([{ providerId: "google" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = {
      select,
      insert,
    } as unknown as import("@auction/db").Database;

    await publishUserRegistered(db, {
      userId: "user-2",
      email: "b@example.com",
      name: "Bob",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ source: "google" }),
      }),
    );
  });
});
