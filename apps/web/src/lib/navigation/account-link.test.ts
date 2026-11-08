import { describe, expect, it } from "vitest";
import {
  accountLinkRedirect,
  accountLinkTarget,
  accountsUnavailableHref,
  confirmSwitchHref,
  hopReasonOf,
  isHop,
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

describe("accountLinkTarget", () => {
  it("names the account and the page without the parameter", () => {
    expect(accountLinkTarget(url("/home?tab=a&account=org-1#top"))).toEqual({
      accountId: "org-1",
      next: "/home?tab=a#top",
    });
  });

  it("is null for a plain link, a page outside the client area, or a hop", () => {
    expect(accountLinkTarget(url("/home"))).toBeNull();
    expect(accountLinkTarget(url("/lots/a?account=org-1"))).toBeNull();
    expect(accountLinkTarget(url("/restore-account?account=org-1"))).toBeNull();
  });
});

describe("isHop", () => {
  it("is true for the two routes that write the cookie, not their own pages", () => {
    expect(isHop("/switch-account")).toBe(true);
    expect(isHop("/restore-account")).toBe(true);
    expect(isHop("/switch-account/unavailable")).toBe(false);
    expect(isHop("/switch-account/confirm")).toBe(false);
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

  it("says why a link opens another account only for a record, through the confirm page too", () => {
    expect(switchAccountHref("org-1", "/purchases/p1", { reason: "record" })).toBe(
      "/switch-account?to=org-1&next=%2Fpurchases%2Fp1&reason=record",
    );
    expect(switchAccountHref("org-1", "/home", { notificationFrom: "me" })).toBe(
      "/switch-account?to=org-1&next=%2Fhome&from=me",
    );
    expect(confirmSwitchHref("org-1", "/purchases/p1", "record")).toBe(
      "/switch-account/confirm?to=org-1&next=%2Fpurchases%2Fp1&reason=record",
    );
  });

  it("reads only the one reason it knows", () => {
    expect(hopReasonOf("record")).toBe("record");
    for (const other of ["other", "", null, undefined]) expect(hopReasonOf(other)).toBeNull();
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
