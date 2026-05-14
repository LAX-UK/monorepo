import {
  buildConsentSnapshot,
  parseConsentCookie,
  serializeConsent,
} from "@/lib/analytics/consent/cookie";
import { describe, expect, it } from "vitest";

describe("parseConsentCookie", () => {
  it("returns null for missing or invalid input", () => {
    expect(parseConsentCookie(undefined)).toBeNull();
    expect(parseConsentCookie("")).toBeNull();
    expect(parseConsentCookie("{}")).toBeNull();
    expect(parseConsentCookie("not-json")).toBeNull();
  });

  it("round-trips a v1 snapshot", () => {
    const snap = buildConsentSnapshot({ analytics: true, marketing: false });
    const raw = serializeConsent(snap);
    expect(parseConsentCookie(raw)).toEqual(snap);
  });

  it("parses URL-encoded cookie values", () => {
    const snap = buildConsentSnapshot({ analytics: false, marketing: false });
    const encoded = encodeURIComponent(JSON.stringify(snap));
    expect(parseConsentCookie(encoded)).toEqual(snap);
  });
});
