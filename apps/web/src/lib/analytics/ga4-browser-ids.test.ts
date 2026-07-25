import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseGaClientId,
  parseGaSessionId,
  readGa4BrowserIdsFromDocument,
  serializeGa4BrowserIdsHeader,
} from "./ga4-browser-ids";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GA4 browser identifiers", () => {
  it("parses the GA client id", () => {
    expect(parseGaClientId("GA1.1.1234567890.9876543210")).toBe("1234567890.9876543210");
    expect(parseGaClientId("invalid")).toBeNull();
  });

  it("parses legacy GS1 session cookies", () => {
    expect(parseGaSessionId("GS1.1.1747132561.4.1.1747132655.0.0.0")).toBe("1747132561");
  });

  it("parses current GS2 session cookies regardless of field order", () => {
    expect(parseGaSessionId("GS2.1.o4$g1$s1747132561$t1747132655$j0$l0$h0")).toBe("1747132561");
  });

  it("reads the configured stream cookie and serializes a bounded header", () => {
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-ABC123");
    vi.stubGlobal("document", {
      cookie: "_ga=GA1.1.1234567890.9876543210; _ga_ABC123=GS2.1.s1747132561$o4$g1$t1747132655",
    });
    const ids = readGa4BrowserIdsFromDocument();
    expect(ids).toEqual({
      clientId: "1234567890.9876543210",
      sessionId: "1747132561",
    });
    expect(serializeGa4BrowserIdsHeader(ids)).toBe(
      '{"clientId":"1234567890.9876543210","sessionId":"1747132561"}',
    );
  });

  it("does not guess a stream cookie when the measurement id is absent", () => {
    vi.stubGlobal("document", {
      cookie: "_ga=GA1.1.1234567890.9876543210; _ga_ABC123=GS2.1.s1747132561",
    });
    expect(readGa4BrowserIdsFromDocument()).toEqual({
      clientId: "1234567890.9876543210",
    });
  });
});
