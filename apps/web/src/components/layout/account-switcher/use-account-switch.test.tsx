import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const switchAccount = vi.fn();
const notifyError = vi.fn();

vi.mock("@/lib/legal-entity/acting-context.actions", () => ({ switchActingLegalEntity: vi.fn() }));
vi.mock("@/lib/legal-entity/account-switch-channel", () => ({ announceAccountSwitch: vi.fn() }));
vi.mock("@/lib/navigation/switch-account", () => ({
  switchAccount: (...args: unknown[]) => switchAccount(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { error: (...args: unknown[]) => notifyError(...args) },
}));

import { useAccountSwitch } from "./use-account-switch";

const option = { id: "org-1", current: false } as AccountOption;
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

  it("stays put and says why when the switch is refused", async () => {
    switchAccount.mockResolvedValue({
      kind: "refused",
      title: "Cannot switch",
      description: "No.",
    });
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose(option));
    expect(assign).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith("Cannot switch", { description: "No." });
    expect(result.current.pendingId).toBeNull();
  });

  it("does nothing for the account already in use", async () => {
    const { result } = renderHook(() => useAccountSwitch("/home"));
    await act(() => result.current.choose({ ...option, current: true }));
    expect(switchAccount).not.toHaveBeenCalled();
  });
});
