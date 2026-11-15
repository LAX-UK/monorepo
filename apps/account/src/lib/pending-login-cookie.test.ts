import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PENDING_LOGIN_MAX_AGE_SECONDS,
  openPendingLogin,
  sealPendingLogin,
} from "./pending-login-cookie";

const KEY = "s".repeat(32);
const json = JSON.stringify({ state: "st", nonce: "n", codeVerifier: "v", reauthSubject: "u1" });

const T0 = 1_700_000_000_000;
const MAX_MS = PENDING_LOGIN_MAX_AGE_SECONDS * 1000;

// Signs an arbitrary payload exactly as sealPendingLogin does, to build values it would never produce.
function signRaw(payload: string): string {
  const key = createHmac("sha256", KEY).update("lax:account-login-pending:v1").digest();
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest().toString("base64url")}`;
}

describe("pending login expiry", () => {
  it("opens a fresh value, and one exactly at the limit", () => {
    const sealed = sealPendingLogin(json, KEY, T0);
    expect(openPendingLogin(sealed, KEY, T0 + 1000)).toBe(json);
    expect(openPendingLogin(sealed, KEY, T0 + MAX_MS)).toBe(json);
  });

  it("refuses an expired value", () => {
    expect(
      openPendingLogin(sealPendingLogin(json, KEY, T0), KEY, T0 + MAX_MS + 1000),
    ).toBeUndefined();
  });

  it("allows a little clock skew but refuses a value issued far in the future", () => {
    const sealed = sealPendingLogin(json, KEY, T0);
    expect(openPendingLogin(sealed, KEY, T0 - 30_000)).toBe(json);
    expect(openPendingLogin(sealed, KEY, T0 - 31_000)).toBeUndefined();
  });

  it("refuses a validly signed value that has no usable issued-at", () => {
    for (const payload of [
      JSON.stringify({ pending: json }),
      JSON.stringify({ iat: "1700000000", pending: json }),
      JSON.stringify({ iat: 1_700_000_000 }),
      json,
      "null",
    ]) {
      expect(openPendingLogin(signRaw(payload), KEY, T0)).toBeUndefined();
    }
  });

  it("refuses a tampered issued-at", () => {
    const [body, sig] = sealPendingLogin(json, KEY, T0).split(".") as [string, string];
    const envelope = Buffer.from(body, "base64url").toString("utf8");
    const later = Buffer.from(envelope.replace(/"iat":\d+/, '"iat":1800000000')).toString(
      "base64url",
    );
    expect(openPendingLogin(`${later}.${sig}`, KEY, T0 + 1_000_000)).toBeUndefined();
  });
});

describe("pending login cookie", () => {
  it("round-trips a sealed value", () => {
    expect(openPendingLogin(sealPendingLogin(json, KEY), KEY)).toBe(json);
  });

  it("rejects an unsigned value, including the old plain-JSON cookie", () => {
    expect(openPendingLogin(json, KEY)).toBeUndefined();
    expect(openPendingLogin(Buffer.from(json).toString("base64url"), KEY)).toBeUndefined();
  });

  it("rejects an altered payload or signature", () => {
    const [body, sig] = sealPendingLogin(json, KEY).split(".") as [string, string];
    const forged = Buffer.from(json.replace("u1", "u2")).toString("base64url");
    expect(openPendingLogin(`${forged}.${sig}`, KEY)).toBeUndefined();
    expect(openPendingLogin(`${body}.${sig.slice(0, -2)}AA`, KEY)).toBeUndefined();
    expect(openPendingLogin(`${body}.`, KEY)).toBeUndefined();
    expect(openPendingLogin(`${body}.${sig}.x`, KEY)).toBeUndefined();
  });

  it("rejects a value sealed with another key, and never throws on junk", () => {
    expect(openPendingLogin(sealPendingLogin(json, "o".repeat(32)), KEY)).toBeUndefined();
    for (const junk of ["", ".", "..", "%%%.%%%", undefined]) {
      expect(openPendingLogin(junk, KEY)).toBeUndefined();
    }
  });
});
