import { describe, expect, it } from "vitest";
import { fingerprintDevice } from "./known-device.js";

// Known-device fingerprints are stored, so their inputs must never drift: a changed hash makes a
// device the person already uses look new and sends them a false "new sign-in" email. These values
// were computed with the fingerprint code on main before the device list changed its wording.
describe("fingerprintDevice", () => {
  it("keeps the fingerprint of an unrecognised agent unchanged", () => {
    expect(fingerprintDevice({ userId: "user-fp-1", userAgent: null, region: "GB" })).toBe(
      "2a969c121cd9202a691ff9381ca477f7cf8fe8fd47564acd4f78594dbee1ee62",
    );
    expect(fingerprintDevice({ userId: "user-fp-1", userAgent: "curl/8.4.0", region: "" })).toBe(
      "f04df0db6791cd48b407d4e3b1c23ce4a61765d504d3c80e1777f4864a83a132",
    );
    expect(fingerprintDevice({ userId: "user-fp-1", userAgent: "", region: null })).toBe(
      "f04df0db6791cd48b407d4e3b1c23ce4a61765d504d3c80e1777f4864a83a132",
    );
  });

  it("ignores browser versions and the region's case", () => {
    const a = fingerprintDevice({
      userId: "user-fp-1",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36",
      region: "gb",
    });
    const b = fingerprintDevice({
      userId: "user-fp-1",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0 Safari/537.36",
      region: "GB",
    });
    expect(a).toBe(b);
  });
});
