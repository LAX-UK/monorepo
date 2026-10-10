import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAccountLoginRedirect,
  pinsForTargetSha,
  smokeProbes,
} from "./staging-deploy-smoke.mjs";

function redirect(location, status = 307) {
  return new Response(null, { status, headers: location ? { location } : {} });
}

const goodAuthorize =
  "https://test-auth.lax.bid/api/auth/oauth2/authorize?client_id=lax-account-web&redirect_uri=https%3A%2F%2Ftest-account.lax.bid%2Fapi%2Fauth%2Fcallback&code_challenge_method=S256";

describe("account smoke", () => {
  it("probes account only once the component is live", () => {
    const sha = "a".repeat(40);
    const absent = smokeProbes({
      smokeAuth: true,
      smokeShop: false,
      ...pinsForTargetSha({ auth: sha }, sha),
    });
    assert.equal(absent.accountLoginRedirect, false);
    assert.equal(absent.readinessAccount, false);
    const pinned = smokeProbes({
      smokeAuth: false,
      smokeShop: false,
      ...pinsForTargetSha({ account: sha }, sha),
    });
    assert.equal(pinned.readinessAccount, true);
    assert.equal(pinned.accountLoginRedirect, true);
  });

  it("accepts a PKCE authorize redirect for lax-account-web", () => {
    assert.doesNotThrow(() => assertAccountLoginRedirect(redirect(goodAuthorize)));
  });

  it("rejects non-redirects and wrong clients", () => {
    assert.throws(() => assertAccountLoginRedirect(redirect(null, 200)), /did not redirect/);
    assert.throws(
      () => assertAccountLoginRedirect(redirect(goodAuthorize.replace("lax-account-web", "x"))),
      /unexpected authorize URL/,
    );
  });
});

describe("smokeProbes", () => {
  it("enables auth and shop probes independently", () => {
    assert.deepEqual(smokeProbes({ smokeAuth: true, smokeShop: false }).authDiscovery, true);
    assert.deepEqual(smokeProbes({ smokeAuth: true, smokeShop: false }).shopStripeWebhook, false);
    assert.deepEqual(smokeProbes({ smokeAuth: false, smokeShop: true }).shopAdminOidc, true);
  });

  it("skips readiness when component tag unchanged", () => {
    const sha = "a".repeat(40);
    const pins = pinsForTargetSha({ api: sha, web: "b".repeat(40) }, sha);
    const probes = smokeProbes({ smokeAuth: false, smokeShop: false, ...pins });
    assert.equal(probes.readinessApi, true);
    assert.equal(probes.readinessWeb, false);
  });
});
