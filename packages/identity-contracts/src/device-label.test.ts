import { describe, expect, it } from "vitest";
import { formatDeviceLabel } from "./device-label.js";

describe("formatDeviceLabel", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Chrome on macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Safari on iPhone",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
      "Chrome on iPad",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      "Edge on Windows",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox on Linux"],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36",
      "Samsung Internet on Android",
    ],
  ])("labels %s", (userAgent, label) => {
    expect(formatDeviceLabel(userAgent)).toBe(label);
  });

  it("falls back to whichever half it knows, then to an unknown device", () => {
    expect(formatDeviceLabel("curl/8.4.0")).toBe("Unknown device");
    expect(formatDeviceLabel("")).toBe("Unknown device");
    expect(formatDeviceLabel(null)).toBe("Unknown device");
    expect(formatDeviceLabel(undefined)).toBe("Unknown device");
    expect(formatDeviceLabel("Mozilla/5.0 (Macintosh)")).toBe("macOS");
    expect(formatDeviceLabel("Safari/605")).toBe("Safari");
  });
});
