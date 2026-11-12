import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { XeroTokenSealer, XeroTokenSealingError } from "./sealing.js";

const KEY = randomBytes(32).toString("hex");
const tokens = { accessToken: "access-token-plain", refreshToken: "refresh-token-plain" };
const none = {
  accessToken: null,
  refreshToken: null,
  accessTokenSealed: null,
  refreshTokenSealed: null,
};

describe("XeroTokenSealer", () => {
  it("round-trips tokens through the envelope and stores nothing in the clear", () => {
    const sealer = XeroTokenSealer.fromKey(KEY);
    const columns = sealer.seal(tokens);

    expect(columns.accessToken).toBeNull();
    expect(columns.refreshToken).toBeNull();
    expect(columns.accessTokenSealed).toMatch(/^v1:/);
    expect(columns.refreshTokenSealed).toMatch(/^v1:/);
    expect(JSON.stringify(columns)).not.toContain(tokens.accessToken);
    expect(JSON.stringify(columns)).not.toContain(tokens.refreshToken);
    expect(sealer.open(columns)).toEqual(tokens);
  });

  it("seals the same token to a different envelope each time", () => {
    const sealer = XeroTokenSealer.fromKey(KEY);
    expect(sealer.seal(tokens).accessTokenSealed).not.toBe(sealer.seal(tokens).accessTokenSealed);
  });

  it("refuses to seal without a key, so a token is never written in the clear", () => {
    for (const missing of [undefined, null, "", "   "]) {
      expect(() => XeroTokenSealer.fromKey(missing)).toThrow(
        new XeroTokenSealingError("key_missing"),
      );
    }
    expect(() => XeroTokenSealer.unavailable().seal(tokens)).toThrow(/key_missing/);
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => XeroTokenSealer.fromKey("abc")).toThrow(/32 bytes/);
  });

  it("reads a row that was never sealed", () => {
    const legacy = { ...none, accessToken: "old-a", refreshToken: "old-r" };
    expect(XeroTokenSealer.fromKey(KEY).open(legacy)).toEqual({
      accessToken: "old-a",
      refreshToken: "old-r",
    });
    expect(() => XeroTokenSealer.unavailable().open(legacy)).toThrow(/key_missing/);
  });

  it("prefers a plaintext value over a sealed one: only an older release writes plaintext", () => {
    const sealer = XeroTokenSealer.fromKey(KEY);
    const opened = sealer.open({
      ...sealer.seal(tokens),
      accessToken: "newer-a",
      refreshToken: "newer-r",
    });
    expect(opened).toEqual({ accessToken: "newer-a", refreshToken: "newer-r" });
  });

  it("rejects a sealed column that is not an envelope", () => {
    const sealer = XeroTokenSealer.fromKey(KEY);
    const raw = { ...none, accessTokenSealed: "raw-access", refreshTokenSealed: "raw-refresh" };
    expect(() => sealer.open(raw)).toThrow(new XeroTokenSealingError("unreadable"));
  });

  it("fails closed: sealed data without the key, with another key, or tampered", () => {
    const columns = XeroTokenSealer.fromKey(KEY).seal(tokens);
    const unreadable = new XeroTokenSealingError("unreadable");
    expect(() => XeroTokenSealer.unavailable().open(columns)).toThrow(
      new XeroTokenSealingError("key_missing"),
    );
    expect(() => XeroTokenSealer.fromKey(randomBytes(32).toString("hex")).open(columns)).toThrow(
      unreadable,
    );
    const tampered = { ...columns, accessTokenSealed: `${columns.accessTokenSealed}A` };
    expect(() => XeroTokenSealer.fromKey(KEY).open(tampered)).toThrow(unreadable);
  });

  it("reports a row with no token at all", () => {
    expect(() => XeroTokenSealer.fromKey(KEY).open(none)).toThrow(
      new XeroTokenSealingError("tokens_missing"),
    );
  });
});
