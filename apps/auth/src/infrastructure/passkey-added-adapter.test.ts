import { describe, expect, it, vi } from "vitest";
import { wrapPasskeyAddedAdapter } from "./passkey-added-adapter.js";

const data = {
  name: "iCloud Keychain",
  userId: "u1",
  credentialID: "cred-1",
  publicKey: "public-key",
  counter: 0,
  deviceType: "multiDevice" as const,
  backedUp: true,
  transports: "internal",
  aaguid: "00000000-0000-0000-0000-000000000000",
};

const stored = {
  id: "pk-1",
  userId: "u1",
  name: "iCloud Keychain",
  publicKey: "public-key",
  credentialId: "cred-1",
  counter: 0,
  deviceType: "multiDevice",
  backedUp: true,
  transports: "internal",
  aaguid: "00000000-0000-0000-0000-000000000000",
  createdAt: new Date("2026-11-10T09:00:00Z"),
  lastUsedAt: null,
};

function setup(options: { insertFails?: Error; publishFails?: Error } = {}) {
  const order: string[] = [];
  const inserted: unknown[] = [];
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((row: unknown) => {
        inserted.push(row);
        order.push("insert");
        return {
          returning: vi.fn(async () => {
            if (options.insertFails) throw options.insertFails;
            return [stored];
          }),
        };
      }),
    })),
  };
  let committed = false;
  const db = {
    transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => {
      const result = await fn(tx);
      committed = true;
      return result;
    }),
  };
  const events = {
    publish: vi.fn(async (_event: unknown, _options?: unknown) => {
      order.push("publish");
      if (options.publishFails) throw options.publishFails;
    }),
  };
  const create = vi.fn(async () => ({ id: "other" }));
  const adapter = wrapPasskeyAddedAdapter(
    {
      create,
      transaction: vi.fn(async (cb: (a: never) => Promise<unknown>) => cb({ create } as never)),
    } as never,
    { db: db as never, events: events as never },
  );
  return { adapter, db, tx, events, create, order, inserted, isCommitted: () => committed };
}

describe("wrapPasskeyAddedAdapter", () => {
  it("stores the passkey and its added event in one transaction, the event inside it", async () => {
    const { adapter, events, tx, order, isCommitted } = setup();
    await adapter.create({ model: "passkey", data });
    expect(order).toEqual(["insert", "publish"]);
    expect(events.publish).toHaveBeenCalledWith(
      { type: "user.sign_in_method_added", userId: "u1", method: "passkey" },
      { transaction: tx },
    );
    expect(isCommitted()).toBe(true);
  });

  it("returns the record in the plugin's own field names, as it expects", async () => {
    const { adapter } = setup();
    expect(await adapter.create({ model: "passkey", data })).toMatchObject({
      id: "pk-1",
      userId: "u1",
      credentialID: "cred-1",
      publicKey: "public-key",
      deviceType: "multiDevice",
    });
  });

  it("stores no passkey when the event cannot be stored: both roll back together", async () => {
    const { adapter, isCommitted } = setup({ publishFails: new Error("outbox down") });
    await expect(adapter.create({ model: "passkey", data })).rejects.toThrow("outbox down");
    expect(isCommitted()).toBe(false);
  });

  it("publishes nothing when the passkey cannot be stored (the limit, a duplicate)", async () => {
    const limit = Object.assign(new Error("passkey_limit"), { code: "23514" });
    const { adapter, events } = setup({ insertFails: limit });
    await expect(adapter.create({ model: "passkey", data })).rejects.toBe(limit);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("leaves every other model to the adapter underneath", async () => {
    const { adapter, create, db } = setup();
    expect(await adapter.create({ model: "session", data: {} })).toEqual({ id: "other" });
    expect(create).toHaveBeenCalledOnce();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("applies the same inside a transaction of the adapter underneath", async () => {
    const { adapter, events } = setup();
    await adapter.transaction(async (tx) => tx.create({ model: "passkey", data }));
    expect(events.publish).toHaveBeenCalledOnce();
  });
});
