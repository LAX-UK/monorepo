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

import { NotificationSwitchToast } from "./notification-switch-toast";

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
  account: { kind: "organisation", name: "Cedar & Stone", initials: "CS" },
  fromAccountId: "me",
  fromKind: "personal",
} as const;

async function switchBack() {
  render(<NotificationSwitchToast {...view} />);
  act(() => vi.advanceTimersByTime(20));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Switch back" }));
  });
}

describe("NotificationSwitchToast", () => {
  it("names the account in a polite live region", () => {
    render(<NotificationSwitchToast {...view} />);
    act(() => vi.advanceTimersByTime(20));
    const region = screen.getByTestId("notification-switch-toast");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Now acting as Cedar & Stone");
  });

  it("switches back to the other account's own page, not to the record it cannot open", async () => {
    await switchBack();
    expect(assign).toHaveBeenCalledWith("/bids");
  });

  it("stays on a page both accounts have", async () => {
    pathname.value = "/notifications";
    await switchBack();
    expect(assign).toHaveBeenCalledWith("/notifications");
    pathname.value = "/purchases/abc-123";
  });
});
