import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const choose = vi.fn(async () => {});
const useAccountSwitch = vi.fn((_destination?: string) => ({ pendingId: null, choose }));
vi.mock("@/components/layout/account-switcher/use-account-switch", () => ({
  useAccountSwitch: (destination?: string) => useAccountSwitch(destination),
}));

import { AccountSwitchLink } from "./account-switch-link";

describe("AccountSwitchLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches through the server action and never follows the link on a plain click", () => {
    render(<AccountSwitchLink href="/home?account=org-1">Open</AccountSwitchLink>);
    const link = screen.getByRole("link", { name: "Open" });
    // The address stays a working page load for browsers without scripts.
    expect(link).toHaveAttribute("href", "/home?account=org-1");

    expect(fireEvent.click(link)).toBe(false);

    expect(useAccountSwitch).toHaveBeenCalledWith("/home");
    expect(choose).toHaveBeenCalledWith({ id: "org-1", current: false });
  });

  it("leaves modified clicks to the browser (new tab)", () => {
    render(<AccountSwitchLink href="/home?account=org-1">Open</AccountSwitchLink>);
    expect(fireEvent.click(screen.getByRole("link"), { metaKey: true })).toBe(true);
    expect(choose).not.toHaveBeenCalled();
  });

  it("keeps the rest of the page's query for the destination", () => {
    render(<AccountSwitchLink href="/team?tab=a&account=org-1">Team</AccountSwitchLink>);
    expect(useAccountSwitch).toHaveBeenCalledWith("/team?tab=a");
  });

  it("is an ordinary client link when no account is named", () => {
    render(<AccountSwitchLink href="/onboarding/step">Finish</AccountSwitchLink>);
    fireEvent.click(screen.getByRole("link", { name: "Finish" }));
    expect(choose).not.toHaveBeenCalled();
    expect(useAccountSwitch).not.toHaveBeenCalled();
  });
});
