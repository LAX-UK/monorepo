import { describe, expect, it, vi } from "vitest";
import {
  PASSKEY_LIMIT_ERROR_CODE,
  isPasskeyLimitError,
  wrapPasskeyLimitAdapter,
} from "./passkey-limit-adapter.js";

/** What the driver raises for the trigger's `RAISE EXCEPTION 'passkey_limit' USING ERRCODE = '23514'`. */
const limitError = () => Object.assign(new Error("passkey_limit"), { code: "23514" });

function adapterThatFails(error: unknown) {
  return {
    create: vi.fn(async () => {
      throw error;
    }),
    transaction: vi.fn(async (cb: (tx: never) => Promise<unknown>) =>
      cb(adapterThatFails(error) as never),
    ),
  };
}

describe("isPasskeyLimitError", () => {
  it("recognises the check violation raised by the passkey cap, also when an ORM wrapped it", () => {
    expect(isPasskeyLimitError(limitError())).toBe(true);
    expect(
      isPasskeyLimitError(Object.assign(new Error("query failed"), { cause: limitError() })),
    ).toBe(true);
  });

  it("does not take other check violations, other codes or other errors for it", () => {
    expect(
      isPasskeyLimitError(Object.assign(new Error("passkey_name_ck"), { code: "23514" })),
    ).toBe(false);
    expect(isPasskeyLimitError(Object.assign(new Error("passkey_limit"), { code: "23505" }))).toBe(
      false,
    );
    expect(isPasskeyLimitError(new Error("passkey_limit"))).toBe(false);
    expect(isPasskeyLimitError(null)).toBe(false);
  });
});

describe("wrapPasskeyLimitAdapter", () => {
  it("answers an insert past the cap with the passkey_limit code and a status of 422", async () => {
    const wrapped = wrapPasskeyLimitAdapter(adapterThatFails(limitError()) as never);
    await expect(wrapped.create({ model: "passkey", data: {} })).rejects.toMatchObject({
      status: "UNPROCESSABLE_ENTITY",
      body: { code: PASSKEY_LIMIT_ERROR_CODE },
    });
  });

  it("leaves other models and other errors exactly as they were", async () => {
    const original = limitError();
    const wrapped = wrapPasskeyLimitAdapter(adapterThatFails(original) as never);
    await expect(wrapped.create({ model: "session", data: {} })).rejects.toBe(original);
    const other = new Error("connection lost");
    await expect(
      wrapPasskeyLimitAdapter(adapterThatFails(other) as never).create({
        model: "passkey",
        data: {},
      }),
    ).rejects.toBe(other);
  });

  it("applies inside a transaction too", async () => {
    const wrapped = wrapPasskeyLimitAdapter(adapterThatFails(limitError()) as never);
    await expect(
      wrapped.transaction(async (tx) => tx.create({ model: "passkey", data: {} })),
    ).rejects.toMatchObject({ body: { code: PASSKEY_LIMIT_ERROR_CODE } });
  });
});
