import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { HmacEnquiryDraftTokens } from "./enquiry-draft-token.js";

const SECRET = "test-secret-0123456789-abcdef"; // gitleaks:allow
const NOW = new Date("2026-11-02T10:00:00Z");

function tokens(now = NOW, secret = SECRET) {
  return new HmacEnquiryDraftTokens({ secret, now: () => now });
}

describe("HmacEnquiryDraftTokens", () => {
  it("issues a token for a new draft that is good for 24 hours", () => {
    const issued = tokens().issue();
    expect(issued.draftId).toMatch(/^[0-9a-f-]{36}$/);
    expect(issued.expiresAt.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(tokens().verify(issued.token)).toEqual({ draftId: issued.draftId });
  });

  it("issues a different draft each time", () => {
    expect(tokens().issue().draftId).not.toBe(tokens().issue().draftId);
  });

  it("refuses a token once it has expired", () => {
    const issued = tokens().issue();
    const later = new Date(NOW.getTime() + 24 * 60 * 60 * 1000 + 1000);
    expect(tokens(later).verify(issued.token)).toBeNull();
  });

  it("refuses a token signed with another secret", () => {
    const issued = tokens(NOW, "another-secret-0123456789-abcd").issue(); // gitleaks:allow
    expect(tokens().verify(issued.token)).toBeNull();
  });

  it("refuses a token whose draft was changed", () => {
    const { token } = tokens().issue();
    const [body, signature] = token.split(".") as [string, string];
    const forged = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      d: string;
      e: number;
    };
    forged.d = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";
    const changed = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(tokens().verify(`${changed}.${signature}`)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "x."])("refuses the malformed token %j", (token) => {
    expect(tokens().verify(token)).toBeNull();
  });

  it("refuses a signed body that is not a draft", () => {
    const body = Buffer.from(JSON.stringify({ d: 5, e: 1 })).toString("base64url");
    const signature = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
    expect(tokens().verify(`${body}.${signature}`)).toBeNull();
  });
});
