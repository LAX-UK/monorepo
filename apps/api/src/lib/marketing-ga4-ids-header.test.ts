import { describe, expect, it } from "vitest";
import { parseGa4BrowserIdsHeader } from "./marketing-ga4-ids-header.js";

describe("parseGa4BrowserIdsHeader", () => {
  it("accepts bounded numeric client and session ids", () => {
    expect(
      parseGa4BrowserIdsHeader('{"clientId":"1234567890.9876543210","sessionId":"1747132561"}'),
    ).toEqual({
      clientId: "1234567890.9876543210",
      sessionId: "1747132561",
    });
  });

  it("rejects malformed and oversized values", () => {
    expect(parseGa4BrowserIdsHeader('{"clientId":"forged"}')).toBeNull();
    expect(parseGa4BrowserIdsHeader("x".repeat(257))).toBeNull();
  });
});
