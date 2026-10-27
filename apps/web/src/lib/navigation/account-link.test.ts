import { describe, expect, it } from "vitest";
import {
  accountLinkRedirect,
  restoreAccountHref,
  safeHopNext,
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
  });
});
