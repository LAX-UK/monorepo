import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const switchAccount = vi.fn();
const leaveAccountNotice = vi.fn();
const pathname = { current: "/bids" as string | null };
const notifyError = vi.fn();

vi.mock("@/lib/legal-entity/acting-context.actions", () => ({ switchActingLegalEntity: vi.fn() }));
vi.mock("@/lib/legal-entity/account-switch-channel", () => ({ announceAccountSwitch: vi.fn() }));
vi.mock("@/lib/navigation/switch-account", () => ({
  switchAccount: (...args: unknown[]) => switchAccount(...args),
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({
  leaveAccountNotice: (...args: unknown[]) => leaveAccountNotice(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { error: (...args: unknown[]) => notifyError(...args) },
}));

import { useAccountSwitch } from "./use-account-switch";

const option = {
  id: "org-1",
  current: false,
  kind: "organisation",
  name: "Northbank Gallery",
  initials: "NG",
} as AccountOption;
const assign = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", { value: { assign }, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, "location", { value: realLocation, configurable: true });
  vi.clearAllMocks();
});

describe("useAccountSwitch", () => {
  it("loads the destination afresh once the switch is accepted", async () => {
    switchAccount.mockResolvedValue({ kind: "switched" });
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose(option));
    expect(assign).toHaveBeenCalledWith("/home");
  });

  it("greets the person once on the page it opens", async () => {
    switchAccount.mockResolvedValue({ kind: "switched" });
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose(option));
    expect(leaveAccountNotice).toHaveBeenCalledWith({
      kind: "chose",
      accountId: "org-1",
      accountKind: "organisation",
      accountName: "Northbank Gallery",
      accountInitials: "NG",
    });
  });

  it("stays on a page both accounts have, and opens the first page otherwise", async () => {
    switchAccount.mockResolvedValue({ kind: "switched" });
    const { result } = renderHook(() => useAccountSwitch());
    await act(() => result.current.choose({ ...option, kind: "organisation" }));
    expect(assign).toHaveBeenLastCalledWith("/bids");

    pathname.current = "/selling/new";
    const next = renderHook(() => useAccountSwitch());
    await act(() => next.result.current.choose({ ...option, kind: "organisation" }));
    expect(assign).toHaveBeenLastCalledWith("/home");
    pathname.current = "/bids";
  });

  it("offers a retry in a toast when the switch is refused", async () => {
    switchAccount.mockResolvedValueOnce({
      kind: "refused",
      title: "Could not switch",
      description: "Soon.",
    });
    switchAccount.mockResolvedValueOnce({ kind: "switched" });
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose(option));
    const action = notifyError.mock.calls[0]?.[1].action;
    expect(action.label).toBe("Try again");
    await act(async () => action.onClick());
    expect(assign).toHaveBeenCalledWith("/home");
  });

  it("keeps a refusal for the list to show inline, and retries the same account", async () => {
    switchAccount.mockResolvedValueOnce({
      kind: "refused",
      title: "Could not switch",
      description: "Soon.",
    });
    switchAccount.mockResolvedValueOnce({ kind: "switched" });
    const { result } = renderHook(() => useAccountSwitch("/home", "inline"));
    await act(() => result.current.choose(option));
    expect(notifyError).not.toHaveBeenCalled();
    expect(result.current.failure).toEqual({ title: "Could not switch", description: "Soon." });
    await act(() => result.current.retry());
    expect(result.current.failure).toBeNull();
    expect(switchAccount).toHaveBeenLastCalledWith("org-1", expect.any(Function));
    expect(assign).toHaveBeenCalledWith("/home");
  });

  it("stays put and says why when the switch is refused", async () => {
    switchAccount.mockResolvedValue({
      kind: "refused",
      title: "Cannot switch",
      description: "No.",
    });
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose(option));
    expect(assign).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith("Cannot switch", {
      description: "No.",
      action: { label: "Try again", onClick: expect.any(Function) },
    });
    expect(result.current.pendingId).toBeNull();
  });

  it("does nothing for the account already in use", async () => {
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose({ ...option, current: true }));
    expect(switchAccount).not.toHaveBeenCalled();
  });
});
