import { describe, expect, it } from "vitest";
import { normalizeLegacyMobile, normalizePhoneInput, phoneDigitsForPiiHash } from "./normalize.js";

describe("normalizePhoneInput", () => {
  it("normalizes GB national number", () => {
    const r = normalizePhoneInput({ country: "GB", number: "7400123456" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.e164).toBe("+447400123456");
      expect(r.value.country).toBe("GB");
    }
  });

  it("normalizes international paste", () => {
    const r = normalizePhoneInput({ country: "GB", number: "+1 415 555 0123" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.e164).toBe("+14155550123");
      expect(r.value.country).toBe("US");
    }
  });

  it("rejects invalid number", () => {
    const r = normalizePhoneInput({ country: "GB", number: "123" });
    expect(r.ok).toBe(false);
  });

  it("hashes E.164 digits consistently", () => {
    expect(phoneDigitsForPiiHash("+44 7700 900123")).toBe("447700900123");
  });
});

describe("normalizeLegacyMobile", () => {
  it("parses legacy string with country hint", () => {
    const r = normalizeLegacyMobile("7400123456", "GB");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.e164).toBe("+447400123456");
  });
});
