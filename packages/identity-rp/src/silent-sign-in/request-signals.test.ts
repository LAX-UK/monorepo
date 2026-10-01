import { describe, expect, it } from "vitest";
import { isDocumentNavigation, isNextRscRequest, isPrefetch } from "./request-signals.js";

describe("request-signals", () => {
  it("detects Next.js router prefetch", () => {
    const headers = new Map<string, string>([["next-router-prefetch", "1"]]);
    expect(isPrefetch((n) => headers.get(n.toLowerCase()) ?? null)).toBe(true);
  });

  it("detects RSC flight requests", () => {
    const headers = new Map<string, string>([["rsc", "1"]]);
    expect(isNextRscRequest((n) => headers.get(n.toLowerCase()) ?? null)).toBe(true);
  });

  it("treats document navigation as non-prefetch", () => {
    const headers = new Map<string, string>([
      ["sec-fetch-mode", "navigate"],
      ["sec-fetch-dest", "document"],
    ]);
    expect(isDocumentNavigation("GET", (n) => headers.get(n.toLowerCase()) ?? null)).toBe(true);
    expect(isPrefetch((n) => headers.get(n.toLowerCase()) ?? null)).toBe(false);
  });
});
