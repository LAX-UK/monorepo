import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseAuthDekKey } from "./dek.js";
import { createEnvelopeCrypto } from "./envelope.js";

describe("createEnvelopeCrypto", () => {
  it("round-trips utf8", () => {
    const key = parseAuthDekKey(randomBytes(32).toString("hex"));
    const c = createEnvelopeCrypto(key);
    const msg = "hello oauth token 🔐";
    expect(c.open(c.seal(msg))).toBe(msg);
  });

  it("passes through plaintext without prefix", () => {
    const key = parseAuthDekKey(randomBytes(32).toString("hex"));
    const c = createEnvelopeCrypto(key);
    expect(c.open("not-encrypted")).toBe("not-encrypted");
  });
});
