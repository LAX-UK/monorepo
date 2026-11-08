import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/purchases/abc-123" }));
const switchAccount = vi.fn();
const assign = vi.fn();
const realLocation = window.location;

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({ switchActingLegalEntity: vi.fn() }));
vi.mock("@/lib/legal-entity/account-switch-channel", () => ({ announceAccountSwitch: vi.fn() }));
vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({
  clearAccountNotice: vi.fn(),
  leaveAccountNotice: vi.fn(),
}));
vi.mock("@/lib/navigation/switch-account", () => ({
  switchAccount: (...args: unknown[]) => switchAccount(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn() } }));

import { RecordSwitchToast } from "./record-switch-toast";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "location", { value: { assign }, configurable: true });
  switchAccount.mockResolvedValue({ kind: "switched" });
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "location", { value: realLocation, configurable: true });
  vi.clearAllMocks();
});

const view = {
  account: { kind: "organisation", initials: "NG" },
  title: "Opened in Northbank Gallery",
  detail: "This record belongs to the organisation.",
  backLabel: "Back to Personal",
  fromKind: "personal",
  fromAccountId: "me",
} as const;

describe("RecordSwitchToast", () => {
  it("says where the record opened, in a polite live region", () => {
    render(<RecordSwitchToast {...view} />);
    act(() => vi.advanceTimersByTime(20));
    const region = screen.getByTestId("record-switch-toast");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Opened in Northbank Gallery");
    expect(region).toHaveTextContent("This record belongs to the organisation.");
  });

  it("goes back to the account the link came from, on its own page for a record", async () => {
    render(<RecordSwitchToast {...view} />);
    act(() => vi.advanceTimersByTime(20));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Back to Personal" }));
    });
    expect(switchAccount).toHaveBeenCalledWith("me", expect.any(Function));
    expect(assign).toHaveBeenCalledWith("/bids");
  });
});
