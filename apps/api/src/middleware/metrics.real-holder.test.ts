import { isSigningKeyCurrent } from "@auction/identity-contracts/verify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jwksEventTotals } from "./metrics.js";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("JWKS metrics with a real holder", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("counts a failed fetch from the shared holder a verifier uses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    const before = jwksEventTotals().fetch_failed;
    const token = `${b64({ alg: "RS256", kid: "a" })}.${b64({ iat: 1 })}.sig`;
    await isSigningKeyCurrent({
      token,
      jwksUrl: "https://auth.real-holder.test/.well-known/jwks.json",
    });
    expect(jwksEventTotals().fetch_failed).toBe(before + 1);
  });
});
