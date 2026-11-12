import type { AccountSession } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { buildDevicesSection } from "./account-devices-section.vm";
import { buildReauthHref } from "./account-reauth";
import {
  buildSessionsVm,
  buildSignOutDeviceConfirm,
  buildSignOutOthersConfirm,
  buildSignedOutDeviceMessage,
  buildSignedOutOthersMessage,
} from "./account-sessions.vm";

const NOW = new Date("2026-10-23T12:00:00.000Z");
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function session(overrides: Partial<AccountSession> & { id: string }): AccountSession {
  return {
    userAgent: MAC,
    createdAt: ago(5 * MINUTE),
    lastActiveAt: ago(0),
    isCurrent: false,
    signedInWith: null,
    deviceKind: "laptop",
    country: null,
    products: [],
    ...overrides,
  };
}

describe("buildSessionsVm", () => {
  it("separates this device from the others and describes each", () => {
    const vm = buildSessionsVm(
      [
        session({
          id: "phone",
          userAgent: IPHONE,
          deviceKind: "phone",
          country: "FR",
          products: ["lax-shop-web", "lax-art-web"],
          lastActiveAt: ago(2 * HOUR),
          createdAt: ago(3 * DAY),
        }),
        session({
          id: "mac",
          isCurrent: true,
          country: "GB",
          products: ["lax-bid-web", "lax-account-web"],
        }),
      ],
      NOW,
    );
    expect(vm.current).toEqual({
      id: "mac",
      deviceLabel: "Chrome on macOS",
      deviceKind: "laptop",
      isCurrent: true,
      activity: "Active now · United Kingdom",
      signedIn: "Signed in Fri 23 Oct · LAX Account, LAX Bid",
    });
    expect(vm.others).toEqual([
      {
        id: "phone",
        deviceLabel: "Safari on iPhone",
        deviceKind: "phone",
        isCurrent: false,
        activity: "Last active 2 hours ago · France",
        signedIn: "Signed in Tue 20 Oct · LAX Shop, lax.art",
      },
    ]);
  });

  it("lists the most recently active other devices first", () => {
    const vm = buildSessionsVm(
      [
        session({ id: "old", lastActiveAt: ago(9 * DAY) }),
        session({ id: "new", lastActiveAt: ago(HOUR) }),
        session({ id: "me", isCurrent: true }),
      ],
      NOW,
    );
    expect(vm.others.map((row) => row.id)).toEqual(["new", "old"]);
  });

  it("says a device is active now for 15 minutes, then how long ago for a week, then the date", () => {
    const activity = (lastActiveAt: string) =>
      buildSessionsVm([session({ id: "x", lastActiveAt })], NOW).others[0]?.activity;
    expect(activity(ago(14 * MINUTE))).toBe("Active now");
    expect(activity(ago(16 * MINUTE))).toBe("Last active 16 minutes ago");
    expect(activity(ago(6 * DAY))).toBe("Last active 6 days ago");
    expect(activity(ago(8 * DAY))).toBe("Last active Thu 15 Oct");
  });

  it("leaves out what is not known instead of wording it as unknown", () => {
    const row = buildSessionsVm([session({ id: "x", country: null, products: [] })], NOW).others[0];
    expect(row?.activity).toBe("Active now");
    expect(row?.signedIn).toBe("Signed in Fri 23 Oct");
  });

  it("names only the four products, in the list's order", () => {
    const row = buildSessionsVm(
      [session({ id: "x", products: ["lax-art-web", "lax-shop-admin", "lax-bid-web"] })],
      NOW,
    ).others[0];
    expect(row?.signedIn).toBe("Signed in Fri 23 Oct · LAX Bid, lax.art");
  });

  it("shows the year once a date is not in the current year", () => {
    const row = buildSessionsVm(
      [session({ id: "x", createdAt: "2025-12-30T12:00:00.000Z", lastActiveAt: ago(40 * DAY) })],
      NOW,
    ).others[0];
    expect(row?.signedIn).toBe("Signed in Tue 30 Dec 2025");
  });

  it("falls back to an unknown browser and tolerates no current session", () => {
    const vm = buildSessionsVm([session({ id: "x", userAgent: null })], NOW);
    expect(vm.current).toBeNull();
    expect(vm.others[0]?.deviceLabel).toBe("Unknown browser");
    expect(vm.others[0]?.deviceKind).toBe("laptop");
  });
});

describe("sign-out results", () => {
  it("name the device that was signed out", () => {
    expect(buildSignedOutDeviceMessage({ deviceLabel: "Safari on iPhone" })).toBe(
      "Safari on iPhone is signed out.",
    );
  });

  it("say one other device, or everywhere else", () => {
    expect(buildSignedOutOthersMessage(1)).toBe("Your other device is signed out.");
    expect(buildSignedOutOthersMessage(3)).toBe("You're signed out everywhere else.");
  });
});

describe("sign-out confirmations", () => {
  it("name the device and the consequence", () => {
    expect(buildSignOutDeviceConfirm({ deviceLabel: "Safari on iPhone" })).toMatchObject({
      title: "Sign out Safari on iPhone?",
      confirmLabel: "Sign out",
    });
    expect(buildSignOutDeviceConfirm({ deviceLabel: "x" }).body).toContain(
      "will need to sign in again",
    );
  });

  it("say how many devices go and that this one stays", () => {
    const one = buildSignOutOthersConfirm(1);
    expect(one.body).toBe(
      "1 other device will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art. You'll stay signed in on this device.",
    );
    expect(buildSignOutOthersConfirm(3).body).toContain("3 other devices");
    expect(one.confirmLabel).toBe("Sign out everywhere else");
    expect(one.loadingLabel).toBe("Signing out…");
  });
});

describe("buildDevicesSection", () => {
  it("shows the list when the issuer answered", () => {
    const section = buildDevicesSection(
      { status: "ok", value: [session({ id: "a", isCurrent: true })] },
      NOW,
    );
    expect(section).toMatchObject({
      status: "list",
      sessions: { current: { id: "a" }, others: [] },
    });
  });

  it("asks to sign in again when the issuer no longer knows this sign-in", () => {
    expect(buildDevicesSection({ status: "reauth_required" }, NOW)).toEqual({
      status: "reauth_required",
    });
  });

  it("is unavailable, not empty, when the issuer could not answer or was not asked", () => {
    expect(buildDevicesSection({ status: "unavailable" }, NOW)).toEqual({ status: "unavailable" });
    expect(buildDevicesSection(null, NOW)).toEqual({ status: "unavailable" });
  });
});

describe("buildReauthHref", () => {
  it("returns to the same page after a fresh sign-in", () => {
    expect(buildReauthHref("/account/security")).toBe(
      "/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth",
    );
  });
});
