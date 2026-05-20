import { describe, expect, it } from "vitest";
import { defaultUserAgentParser, formatDeviceLabel, parseUserAgent } from "./parse-user-agent";

describe("parseUserAgent", () => {
  it("parses Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const p = parseUserAgent(ua);
    expect(p.browser).toBe("Chrome");
    expect(p.os).toMatch(/macOS/);
    expect(p.deviceType).toBe("desktop");
    expect(formatDeviceLabel(p)).toMatch(/Chrome on macOS/);
  });

  it("parses Mobile Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const p = parseUserAgent(ua);
    expect(p.deviceType).toBe("mobile");
    expect(formatDeviceLabel(p)).toBeTruthy();
  });

  it("handles null", () => {
    const p = parseUserAgent(null);
    expect(formatDeviceLabel(p)).toBe("Unknown device");
  });

  it("defaultUserAgentParser delegates to parseUserAgent", () => {
    expect(defaultUserAgentParser.parse("")).toEqual(parseUserAgent(""));
  });
});
