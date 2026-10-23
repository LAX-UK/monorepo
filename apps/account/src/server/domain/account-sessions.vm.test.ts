import type { AccountSession } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { buildDevicesSection } from "./account-devices-section.vm";
import { buildReauthHref } from "./account-reauth";
import {
  buildSessionsVm,
  buildSignOutDeviceConfirm,
  buildSignOutOthersConfirm,
  formatSessionAge,
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
    ...overrides,
  };
}

describe("formatSessionAge", () => {
  it.each([
    [10_000, "just now"],
    [MINUTE, "1 minute ago"],
    [45 * MINUTE, "45 minutes ago"],
    [HOUR, "1 hour ago"],
    [5 * HOUR, "5 hours ago"],
    [DAY, "1 day ago"],
    [12 * DAY, "12 days ago"],
    [60 * DAY, "on 24 Aug 2026"],
  ])("%i ms ago reads %s", (elapsed, text) => {
    expect(formatSessionAge(new Date(NOW.getTime() - elapsed), NOW)).toBe(text);
  });

  it("never reads as the future when clocks disagree", () => {
    expect(formatSessionAge(new Date(NOW.getTime() + HOUR), NOW)).toBe("just now");
  });
});

describe("buildSessionsVm", () => {
  it("separates this device from the others and labels each by browser and system", () => {
    const vm = buildSessionsVm(
      [
        session({
          id: "phone",
          userAgent: IPHONE,
          lastActiveAt: ago(2 * HOUR),
          createdAt: ago(3 * DAY),
        }),
        session({ id: "mac", isCurrent: true }),
      ],
      NOW,
    );
    expect(vm.current).toEqual({
      id: "mac",
      deviceLabel: "Chrome on macOS",
      detail: "Active now · Signed in 5 minutes ago",
      isCurrent: true,
    });
    expect(vm.others).toEqual([
      {
        id: "phone",
        deviceLabel: "Safari on iPhone",
        detail: "Last active 2 hours ago · Signed in 3 days ago",
        isCurrent: false,
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

  it("falls back to an unknown device and tolerates no current session", () => {
    const vm = buildSessionsVm([session({ id: "x", userAgent: null })], NOW);
    expect(vm.current).toBeNull();
    expect(vm.others[0]?.deviceLabel).toBe("Unknown device");
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
