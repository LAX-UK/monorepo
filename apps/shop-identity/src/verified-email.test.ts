import { describe, expect, it, vi } from "vitest";
import { hasVerifiedEmail } from "./verified-email.js";

function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(claims)}.sig`;
}

describe("hasVerifiedEmail", () => {
  it("passes a verified claim without refreshing", async () => {
    const resolveIdToken = vi.fn();
    await expect(
      hasVerifiedEmail({ resolveIdToken }, "s1", token({ email_verified: true })),
    ).resolves.toBe(true);
    expect(resolveIdToken).not.toHaveBeenCalled();
  });

  it("re-reads a recent token when the current claim is unverified", async () => {
    const resolveIdToken = vi.fn(async () => token({ email_verified: true }));
    await expect(
      hasVerifiedEmail({ resolveIdToken }, "s1", token({ email_verified: false })),
    ).resolves.toBe(true);
    expect(resolveIdToken).toHaveBeenCalledWith("s1", { maxAgeMs: 60_000 });
  });

  it.each([
    ["still unverified", async () => token({ email_verified: false })],
    ["claim missing", async () => token({})],
    [
      "refresh failure",
      async () => {
        throw new Error("upstream");
      },
    ],
  ])("fails closed when %s", async (_label, resolve) => {
    await expect(
      hasVerifiedEmail({ resolveIdToken: vi.fn(resolve) }, "s1", token({})),
    ).resolves.toBe(false);
  });
});
