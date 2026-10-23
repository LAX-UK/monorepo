import { describe, expect, it } from "vitest";
import {
  EMAIL_CHANGE_TOKEN_TTL_SECONDS,
  createEmailChangeToken,
  verifyEmailChangeToken,
} from "./email-change-token.js";

const SECRET = "issuer-secret-for-tests-issuer-secret";
const NOW = new Date("2026-10-23T12:00:00.000Z");
const PAYLOAD = {
  subjectId: "11111111-1111-4111-8111-111111111111",
  oldEmail: "old@example.com",
  newEmail: "new@example.com",
  confirmFor: "old" as const,
};

describe("email change token", () => {
  it("round-trips the payload", () => {
    const token = createEmailChangeToken(PAYLOAD, SECRET, NOW);
    expect(verifyEmailChangeToken(token, SECRET, NOW)).toMatchObject(PAYLOAD);
  });

  it("rejects a token signed with another secret", () => {
    const token = createEmailChangeToken(PAYLOAD, "another-secret-another-secret-0000", NOW);
    expect(verifyEmailChangeToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a token whose body was edited to point at another inbox", () => {
    const [body, signature] = createEmailChangeToken(PAYLOAD, SECRET, NOW).split(".");
    const edited = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body ?? "", "base64url").toString()),
        newEmail: "attacker@example.com",
      }),
    ).toString("base64url");
    expect(verifyEmailChangeToken(`${edited}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createEmailChangeToken(PAYLOAD, SECRET, NOW);
    const later = new Date(NOW.getTime() + (EMAIL_CHANGE_TOKEN_TTL_SECONDS + 1) * 1_000);
    expect(verifyEmailChangeToken(token, SECRET, later)).toBeNull();
  });

  it.each(["", "nodot", "a.b.c", "a.", ".b"])("rejects the malformed token %j", (token) => {
    expect(verifyEmailChangeToken(token, SECRET, NOW)).toBeNull();
  });
});
