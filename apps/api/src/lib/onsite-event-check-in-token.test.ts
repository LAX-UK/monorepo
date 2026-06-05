import { describe, expect, it } from "vitest";
import {
  hashCheckInToken,
  isValidCheckInTokenFormat,
  issueCheckInToken,
  normaliseCheckInToken,
} from "./onsite-event-check-in-token.js";

describe("onsite-event-check-in-token", () => {
  it("issues unique high-entropy tokens", () => {
    const a = issueCheckInToken();
    const b = issueCheckInToken();
    expect(a.plainToken).not.toBe(b.plainToken);
    expect(a.tokenHash).toBe(hashCheckInToken(a.plainToken));
    expect(isValidCheckInTokenFormat(a.plainToken)).toBe(true);
  });

  it("normalises full pass URLs and raw tokens", () => {
    const token = issueCheckInToken().plainToken;
    expect(normaliseCheckInToken(token)).toBe(token);
    expect(normaliseCheckInToken(`https://event.lax.bid/pass/${token}`)).toBe(token);
    expect(normaliseCheckInToken("not-a-token")).toBeNull();
  });
});
