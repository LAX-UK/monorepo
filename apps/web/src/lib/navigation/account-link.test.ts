import { describe, expect, it } from "vitest";
import {
  accountLinkRedirect,
  accountsUnavailableHref,
  confirmSwitchHref,
  refusedPageTarget,
  restoreAccountHref,
  safeHopNext,
  safeRetryTarget,
  switchAccountHref,
} from "./account-link";

function url(path: string): URL {
  return new URL(path, "https://lax.bid");
}

describe("accountLinkRedirect", () => {
  it("sends a client-area link with ?account= through the switch hop, without the parameter", () => {
    expect(accountLinkRedirect(url("/organisation/members?account=org-1"))).toBe(
      "/switch-account?to=org-1&next=%2Forganisation%2Fmembers",
    );
  });

  it("keeps the rest of the query", () => {
    expect(accountLinkRedirect(url("/selling/consignments?tab=in-sale&account=org-1"))).toBe(
      `/switch-account?to=org-1&next=${encodeURIComponent("/selling/consignments?tab=in-sale")}`,
    );
  });

  it("leaves links without the parameter, outside the client area, or on the hop alone", () => {
    expect(accountLinkRedirect(url("/bids"))).toBeNull();
    expect(accountLinkRedirect(url("/lots/abc?account=org-1"))).toBeNull();
    expect(accountLinkRedirect(url("/switch-account?account=org-1"))).toBeNull();
  });
});

describe("safeHopNext", () => {
  it("keeps same-origin pages with their query", () => {
    expect(safeHopNext("/selling/consignments/s1?tab=docs")).toBe(
      "/selling/consignments/s1?tab=docs",
    );
    expect(safeHopNext("/lot/a-study/l1")).toBe("/lot/a-study/l1");
  });

  it("sends anything else Home", () => {
    for (const next of [
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/switch-account?to=x",
      "/restore-account",
    ]) {
      expect(safeHopNext(next)).toBe("/home");
    }
  });
});

describe("hop links", () => {
  it("encodes the destination", () => {
    expect(switchAccountHref("org-1", "/purchases/checkout/l1")).toBe(
      "/switch-account?to=org-1&next=%2Fpurchases%2Fcheckout%2Fl1",
    );
    expect(restoreAccountHref("/bids")).toBe("/restore-account?next=%2Fbids");
    expect(confirmSwitchHref("org-1", "/home")).toBe(
      "/switch-account/confirm?to=org-1&next=%2Fhome",
    );
    expect(accountsUnavailableHref("/restore-account?next=%2Fhome")).toBe(
      `/switch-account/unavailable?retry=${encodeURIComponent("/restore-account?next=%2Fhome")}`,
    );
  });

  it("never comes back to a hop's own pages", () => {
    expect(safeHopNext("/switch-account/confirm?to=org-1")).toBe("/home");
    expect(safeHopNext("/switch-account/unavailable")).toBe("/home");
  });
});

describe("safeRetryTarget", () => {
  it("retries a hop, or opens the page that was being opened", () => {
    expect(safeRetryTarget("/switch-account?to=org-1&next=%2Fhome")).toBe(
      "/switch-account?to=org-1&next=%2Fhome",
    );
    expect(safeRetryTarget("/restore-account?next=%2Fbids")).toBe("/restore-account?next=%2Fbids");
    expect(safeRetryTarget("/selling/consignments/s1")).toBe("/selling/consignments/s1");
  });

  it("sends anything else Home", () => {
    for (const retry of [
      null,
      "https://evil.example",
      "//evil.example",
      "/switch-account/unavailable",
    ]) {
      expect(safeRetryTarget(retry)).toBe("/home");
    }
  });
});

describe("refusedPageTarget", () => {
  it("keeps a page of the app", () => {
    expect(refusedPageTarget("/team/activity")).toBe("/team/activity");
  });

  it("has no target for a missing, unsafe or hop address", () => {
    for (const next of [
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/switch-account",
    ]) {
      expect(refusedPageTarget(next)).toBeNull();
    }
  });
});
