import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notice = vi.hoisted(() => ({ value: null as unknown }));
const clearAccountNotice = vi.fn();
const actingId = vi.hoisted(() => ({ value: "org-1" as string | null }));
const focusPageHeading = vi.fn();

vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({
  readAccountNotice: () => notice.value,
  clearAccountNotice: () => clearAccountNotice(),
}));
vi.mock("@/lib/legal-entity/client-acting-context", () => ({
  getClientActingLegalEntityId: () => actingId.value,
}));
vi.mock("@/lib/ui/focus-page-heading", () => ({
  focusPageHeadingWhenSettled: () => focusPageHeading(),
}));

import { AccountSwitchGreeting, GREETING_SHOWN_MS } from "./account-switch-greeting";

const org = {
  kind: "chose",
  accountId: "org-1",
  accountKind: "organisation",
  accountName: "Northbank Gallery",
  accountInitials: "NG",
};

beforeEach(() => {
  vi.useFakeTimers();
  actingId.value = "org-1";
  notice.value = org;
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const nextFrame = () => act(() => vi.advanceTimersByTime(20));

describe("AccountSwitchGreeting", () => {
  it("puts the message into an empty live region on the next frame, then moves focus", () => {
    render(<AccountSwitchGreeting />);
    const region = screen.getByTestId("account-switch-greeting");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
    expect(focusPageHeading).not.toHaveBeenCalled();

    nextFrame();

    expect(region).toHaveTextContent("Now acting as Northbank Gallery");
    expect(region).toHaveTextContent(
      "Bids, purchases and consignments here are the organisation's.",
    );
    expect(focusPageHeading).toHaveBeenCalledTimes(1);
    expect(clearAccountNotice).toHaveBeenCalledTimes(1);
  });

  it("greets a switch to Personal in its own words", () => {
    actingId.value = "me";
    notice.value = { ...org, accountId: "me", accountKind: "personal", accountName: "Personal" };
    render(<AccountSwitchGreeting />);
    nextFrame();
    expect(screen.getByTestId("account-switch-greeting")).toHaveTextContent(
      "Now using your personal account",
    );
  });

  it("goes away after six seconds, and can be dismissed", () => {
    render(<AccountSwitchGreeting />);
    nextFrame();
    act(() => vi.advanceTimersByTime(GREETING_SHOWN_MS));
    expect(screen.getByTestId("account-switch-greeting")).toBeEmptyDOMElement();
  });

  it("clears a notice left for another account and says nothing", () => {
    actingId.value = "me";
    render(<AccountSwitchGreeting />);
    expect(clearAccountNotice).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("account-switch-greeting")).toBeNull();
  });

  it("leaves other kinds of notice for the layout to show", () => {
    notice.value = { kind: "switched", accountId: "org-1" };
    render(<AccountSwitchGreeting />);
    expect(clearAccountNotice).not.toHaveBeenCalled();
    expect(screen.queryByTestId("account-switch-greeting")).toBeNull();
  });

  it("does nothing without a notice", () => {
    notice.value = null;
    render(<AccountSwitchGreeting />);
    expect(screen.queryByTestId("account-switch-greeting")).toBeNull();
  });
});
