import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let announce: ((accountId: string) => void) | null = null;
vi.mock("@/lib/legal-entity/account-switch-channel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal-entity/account-switch-channel")>()),
  onAccountSwitch: (listener: (accountId: string) => void) => {
    announce = listener;
    return () => {
      announce = null;
    };
  },
}));

let browserAccount: string | undefined = "me";
vi.mock("@/lib/legal-entity/client-acting-context", () => ({
  getClientActingLegalEntityId: () => browserAccount,
}));

const { accountChangedElsewhere, useBiddingAccountFreshness } = await import(
  "./use-bidding-account-freshness"
);

describe("accountChangedElsewhere", () => {
  it("is true only when both are known and differ", () => {
    expect(accountChangedElsewhere("me", "org-1")).toBe(true);
    expect(accountChangedElsewhere("me", "me")).toBe(false);
    expect(accountChangedElsewhere(null, "org-1")).toBe(false);
    expect(accountChangedElsewhere("me", undefined)).toBe(false);
  });
});

describe("useBiddingAccountFreshness", () => {
  beforeEach(() => {
    refresh.mockClear();
    browserAccount = "me";
  });
  afterEach(() => {
    announce = null;
  });

  it("re-renders the panel when another tab switches account", () => {
    renderHook(() => useBiddingAccountFreshness("me"));
    act(() => announce?.("org-1"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores an announcement for the account already shown", () => {
    renderHook(() => useBiddingAccountFreshness("org-1"));
    act(() => announce?.("org-1"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("checks again when the tab regains focus", () => {
    renderHook(() => useBiddingAccountFreshness("me"));
    browserAccount = "org-1";
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a signed-out viewer", () => {
    renderHook(() => useBiddingAccountFreshness(null));
    act(() => announce?.("org-1"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
