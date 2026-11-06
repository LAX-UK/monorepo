import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clearAccountNotice = vi.fn();
vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({
  clearAccountNotice: () => clearAccountNotice(),
}));

import { AccountNotice } from "./account-notice";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("AccountNotice", () => {
  it("is a polite live region that says what changed, and clears its cookie once shown", () => {
    render(<AccountNotice message="Now acting as Northbank Gallery" detail="Bids here are its." />);
    const notice = screen.getByTestId("account-notice");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveTextContent("Now acting as Northbank Gallery");
    expect(notice).toHaveTextContent("Bids here are its.");
    expect(clearAccountNotice).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the page's heading when the person chose the switch", () => {
    render(
      <main>
        <h1>Home</h1>
        <AccountNotice message="Now acting as Northbank Gallery" focusHeading />
      </main>,
    );
    expect(screen.getByRole("heading", { name: "Home" })).toHaveFocus();
  });

  it("leaves focus alone for a change the person did not choose", () => {
    render(
      <main>
        <h1>Home</h1>
        <AccountNotice message="Switched to Northbank Gallery to show this." />
      </main>,
    );
    expect(screen.getByRole("heading", { name: "Home" })).not.toHaveFocus();
  });

  it("goes away by itself when asked to, and can be dismissed sooner", () => {
    const { unmount } = render(<AccountNotice message="Now acting as X" autoDismissMs={6000} />);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByTestId("account-notice")).toBeNull();
    unmount();

    render(<AccountNotice message="Now acting as X" />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("account-notice")).toBeNull();
  });
});
