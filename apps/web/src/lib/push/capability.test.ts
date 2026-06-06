import {
  getNotificationPermission,
  isIosDevice,
  isIosStandalonePwa,
  isPushSupported,
  needsIosInstallForPush,
} from "@/lib/push/capability";
import { describe, expect, it, vi } from "vitest";

describe("push capability", () => {
  it("isPushSupported returns false without serviceWorker", () => {
    const nav = { serviceWorker: undefined } as unknown as Navigator;
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("window", { PushManager: {} });
    expect(isPushSupported()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("getNotificationPermission returns denied when Notification is missing", () => {
    vi.stubGlobal("Notification", undefined);
    expect(getNotificationPermission()).toBe("denied");
    vi.unstubAllGlobals();
  });

  it("isIosDevice detects iPhone user agent", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    expect(isIosDevice()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("needsIosInstallForPush is true on iOS browser mode", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      standalone: false,
    });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(needsIosInstallForPush()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("isIosDevice detects iPadOS Mac user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 5,
    });
    expect(isIosDevice()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("isIosStandalonePwa detects standalone display mode", () => {
    vi.stubGlobal("navigator", { standalone: false });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });
    expect(isIosStandalonePwa()).toBe(true);
    vi.unstubAllGlobals();
  });
});
