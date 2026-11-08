import type { AccountMenuContext } from "@/lib/navigation/account-menu-context";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notice = vi.hoisted(() => ({ value: null as unknown }));
const menuContext = vi.hoisted(() => ({ value: null as AccountMenuContext | null }));
const actingId = vi.hoisted(() => ({ value: "org-1" as string | null }));
const clearAccountNotice = vi.fn();
const focusPageHeading = vi.fn();

vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({
  readAccountNotice: () => notice.value,
  clearAccountNotice: () => clearAccountNotice(),
}));
vi.mock("@/lib/legal-entity/client-acting-context", () => ({
  getClientActingLegalEntityId: () => actingId.value,
}));
vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: { id: "u1" }, pending: false }),
}));
vi.mock("@/lib/auth/client-audience", () => ({ usesBidAsClient: () => true }));
vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => menuContext.value,
}));
vi.mock("@/lib/ui/focus-page-heading", () => ({
  focusPageHeadingWhenSettled: (stop: () => boolean) => {
    if (!stop()) focusPageHeading();
  },
}));

import { AccountSwitchGreeting, GREETING_SHOWN_MS } from "./account-switch-greeting";
import { FOCUS_AFTER_ANNOUNCE_MS } from "./account-toast";

const personal = {
  id: "me",
  kind: "personal",
  name: "Personal",
  detail: "Oliver Grant",
  initials: "OG",
  current: false,
  underReview: false,
} as const;
const northbank = {
  id: "org-1",
  kind: "organisation",
  name: "Northbank Gallery",
  detail: "Owner",
  initials: "NG",
  current: true,
  underReview: false,
} as const;

function serverAccounts(accounts: AccountMenuContext["accounts"]) {
  menuContext.value = { accounts, pendingInvitations: 0 } as AccountMenuContext;
}

beforeEach(() => {
  vi.useFakeTimers();
  actingId.value = "org-1";
  notice.value = { kind: "chose", accountId: "org-1" };
  serverAccounts([personal, northbank]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("AccountSwitchGreeting", () => {
  it("puts the server's name into an empty live region on the next frame, then moves focus later", () => {
    render(<AccountSwitchGreeting />);
    const region = screen.getByTestId("account-switch-greeting");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();

    advance(20);
    expect(region).toHaveTextContent("Now acting as Northbank Gallery");
    expect(region).toHaveTextContent(
      "Bids, purchases and consignments here are the organisation's.",
    );
    // The polite message is read first; focus follows a moment later.
    expect(focusPageHeading).not.toHaveBeenCalled();
    advance(FOCUS_AFTER_ANNOUNCE_MS);
    expect(focusPageHeading).toHaveBeenCalledTimes(1);
    expect(clearAccountNotice).toHaveBeenCalledTimes(1);
  });

  it("does not move focus once the person has started using the page", () => {
    render(<AccountSwitchGreeting />);
    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    advance(20);
    advance(FOCUS_AFTER_ANNOUNCE_MS);
    expect(focusPageHeading).not.toHaveBeenCalled();
  });

  it("ignores a name in the cookie and shows the server's", () => {
    notice.value = { kind: "chose", accountId: "org-1", accountName: "Evil Ltd" };
    render(<AccountSwitchGreeting />);
    advance(20);
    const text = screen.getByTestId("account-switch-greeting").textContent;
    expect(text).toContain("Northbank Gallery");
    expect(text).not.toContain("Evil");
  });

  it("greets a switch to Personal in its own words", () => {
    actingId.value = "me";
    notice.value = { kind: "chose", accountId: "me" };
    serverAccounts([
      { ...personal, current: true },
      { ...northbank, current: false },
    ]);
    render(<AccountSwitchGreeting />);
    advance(20);
    expect(screen.getByTestId("account-switch-greeting")).toHaveTextContent(
      "Now using your personal account",
    );
  });

  it("shows nothing for an id that is not one of the person's accounts", () => {
    notice.value = { kind: "chose", accountId: "someone-else" };
    render(<AccountSwitchGreeting />);
    advance(20);
    expect(screen.queryByTestId("account-switch-greeting")).toBeNull();
    expect(clearAccountNotice).toHaveBeenCalledTimes(1);
  });

  it("shows nothing for an account that is not the one in use", () => {
    notice.value = { kind: "chose", accountId: "me" };
    render(<AccountSwitchGreeting />);
    advance(20);
    expect(screen.queryByTestId("account-switch-greeting")).toBeNull();
  });

  it("waits for the server's accounts before it speaks", () => {
    menuContext.value = null;
    render(<AccountSwitchGreeting />);
    advance(20);
    expect(screen.queryByTestId("account-switch-greeting")).toBeNull();
  });

  it("goes away after six seconds", () => {
    render(<AccountSwitchGreeting />);
    advance(20);
    advance(GREETING_SHOWN_MS);
    expect(screen.getByTestId("account-switch-greeting")).toBeEmptyDOMElement();
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
