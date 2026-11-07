import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const clearAccountNotice = vi.fn();
vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({
  clearAccountNotice: () => clearAccountNotice(),
}));

import { AccountNotice } from "./account-notice";

afterEach(() => vi.clearAllMocks());

describe("AccountNotice", () => {
  it("is a polite live region that says what changed, and clears its cookie once shown", () => {
    render(<AccountNotice message="Switched to Northbank Gallery to show this." />);
    const notice = screen.getByTestId("account-notice");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveTextContent("Switched to Northbank Gallery to show this.");
    expect(clearAccountNotice).toHaveBeenCalledTimes(1);
  });

  it("can be dismissed", () => {
    render(<AccountNotice message="Switched." />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("account-notice")).toBeNull();
  });
});
