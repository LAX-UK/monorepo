import { describe, expect, it } from "vitest";

/**
 * Spike notes (Chromium FedCM):
 * - eTLD+1 for test-auth.lax.bid / auth.lax.bid is lax.bid; well-known should be served on a
 *   lax.bid origin (Bid web hosts /.well-known/web-identity in production rollout).
 * - FedCM only sends SameSite=None cookies to accounts endpoints; Identity session cookies must
 *   be reachable or assertion must mint codes server-side.
 * - Assertion endpoint must validate Sec-Fetch-Dest: webidentity and registered RP origins.
 */
describe("FedCM spike assumptions", () => {
  it("documents eTLD+1 host for well-known", () => {
    expect("lax.bid").toMatch(/lax\.bid$/);
  });
});
