import { describe, expect, it } from "vitest";
import { openPendingLogin, sealPendingLogin } from "./pending-login-cookie";

const KEY = "s".repeat(32);
const json = JSON.stringify({ state: "st", nonce: "n", codeVerifier: "v", reauthSubject: "u1" });

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
