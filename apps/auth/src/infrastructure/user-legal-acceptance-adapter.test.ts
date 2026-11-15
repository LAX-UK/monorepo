import { describe, expect, it, vi } from "vitest";
import { wrapUserLegalAcceptanceAdapter } from "./user-legal-acceptance-adapter.js";

const state = vi.hoisted(() => ({
  context: null as unknown,
  oauth: null as unknown,
}));
vi.mock("@better-auth/core/context", () => ({ getCurrentAuthContext: async () => state.context }));
vi.mock("better-auth/api", () => ({ getOAuthState: async () => state.oauth }));

function setup(recordFails = false) {
  const inserted: unknown[] = [];
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((rows: unknown) => ({
        onConflictDoNothing: vi.fn(async () => {
          if (recordFails) throw new Error("record failed");
          inserted.push(rows);
        }),
      })),
    })),
  };
  let committed = false;
  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      const result = await fn(tx);
      committed = true;
      return result;
    }),
  };
  const direct = vi.fn(async () => ({ id: "direct" }));
  const inTx = vi.fn(async () => ({ id: "user-1" }));
  const base = { create: direct, transaction: vi.fn() };
  const wrapped = wrapUserLegalAcceptanceAdapter(base as never, {
    db: db as never,
    adapterOn: () => ({ create: inTx, transaction: vi.fn() }) as never,
  });
  return { wrapped, direct, inTx, inserted, committed: () => committed };
}

describe("wrapUserLegalAcceptanceAdapter", () => {
  it("writes the record with the user for a social sign-up carrying the statement", async () => {
    state.context = { path: "/callback/:id" };
    state.oauth = { legalAcceptance: { product: "shop" } };
    const s = setup();
    await s.wrapped.create({ model: "user", data: {} });
    expect(s.inTx).toHaveBeenCalledOnce();
    expect(s.direct).not.toHaveBeenCalled();
    expect(s.inserted).toHaveLength(1);
    expect(s.committed()).toBe(true);
  });

  it("stores a user with no statement directly and claims nothing", async () => {
    state.context = { path: "/sign-in/magic-link" };
    state.oauth = null;
    const s = setup();
    await s.wrapped.create({ model: "user", data: {} });
    expect(s.direct).toHaveBeenCalledOnce();
    expect(s.inserted).toHaveLength(0);
  });

  it("does not commit when the record fails", async () => {
    state.context = { path: "/sign-up/email", body: { legalAcceptance: { product: "bid" } } };
    const s = setup(true);
    await expect(s.wrapped.create({ model: "user", data: {} })).rejects.toThrow("record failed");
    expect(s.committed()).toBe(false);
  });

  it("leaves other models alone", async () => {
    state.context = { path: "/sign-up/email", body: { legalAcceptance: { product: "bid" } } };
    const s = setup();
    await s.wrapped.create({ model: "session", data: {} });
    expect(s.direct).toHaveBeenCalledOnce();
  });
});
