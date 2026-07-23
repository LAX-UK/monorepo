import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAttributionCookie,
  readAttributionCookie,
  writeAttributionCookie,
} from "./marketing-attribution-cookie";

function installBrowser(cookie = "", protocol = "https:"): { writes: string[] } {
  const writes: string[] = [];
  const documentStub = {};
  Object.defineProperty(documentStub, "cookie", {
    configurable: true,
    get: () => cookie,
    set: (value: string) => writes.push(value),
  });
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("window", { location: { protocol, href: "https://lax.bid/" } });
  return { writes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("marketing attribution cookie", () => {
  it("rejects malformed snapshots instead of trusting cookie JSON", () => {
    installBrowser(`_lax_attr=${encodeURIComponent(JSON.stringify({ version: 1 }))}`);
    expect(readAttributionCookie()).toBeNull();
  });

  it("uses matching Secure attributes when writing and clearing on HTTPS", () => {
    const { writes } = installBrowser();
    writeAttributionCookie({
      version: 1,
      lastTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: "/campaign",
        utmSource: "newsletter",
      },
    });
    clearAttributionCookie();

    expect(writes[0]).toContain("; Secure");
    expect(writes[1]).toContain("Max-Age=0");
    expect(writes[1]).toContain("; Secure");
  });

  it("does not attempt to write a cookie larger than browser limits", () => {
    const { writes } = installBrowser();
    writeAttributionCookie({
      version: 1,
      firstTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: `/${"a".repeat(2_000)}`,
        utmSource: "x".repeat(256),
      },
      lastTouch: {
        capturedAt: "2026-01-02T00:00:00.000Z",
        landingPath: `/${"b".repeat(2_000)}`,
        utmSource: "y".repeat(256),
      },
    });
    expect(writes).toEqual([]);
  });
});
