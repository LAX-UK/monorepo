import { describe, expect, it } from "vitest";
import { decodeUtf8Base64Url, encodeUtf8Base64Url } from "./utf8-base64url.js";

const SAMPLES = [
  "",
  "a",
  "ab",
  "abc",
  '{"v":1,"e":"2f0c0a7e-6b2e-4c8e-9a41-0a9d1d6f4b11"}',
  "café — £500",
  "日本語 🎨 🚀",
  "?>?>?>~~~///+++",
];

describe("utf8 base64url", () => {
  it.each(SAMPLES)("encodes %j to the same bytes as Buffer", (value) => {
    expect(encodeUtf8Base64Url(value)).toBe(Buffer.from(value, "utf8").toString("base64url"));
  });

  it.each(SAMPLES)("decodes what Buffer encoded: %j", (value) => {
    expect(decodeUtf8Base64Url(Buffer.from(value, "utf8").toString("base64url"))).toBe(value);
  });

  it.each(SAMPLES)("round-trips %j", (value) => {
    expect(decodeUtf8Base64Url(encodeUtf8Base64Url(value))).toBe(value);
  });

  it("accepts padded input", () => {
    expect(decodeUtf8Base64Url("YQ==")).toBe("a");
  });

  it("returns null for input that is not base64url", () => {
    expect(decodeUtf8Base64Url("a")).toBeNull();
    expect(decodeUtf8Base64Url("!!!!")).toBeNull();
  });
});
