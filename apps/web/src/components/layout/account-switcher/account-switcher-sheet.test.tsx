import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountSwitcherSheet } from "./account-switcher-sheet";

vi.mock("@/lib/auth/use-logout", () => ({
  useLogout: () => ({ logout: vi.fn(), pending: false }),
}));
vi.mock("./use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose: vi.fn() }),
}));

const switcher: NonNullable<AccountChrome["switcher"]> = {
  options: [
    {
      id: "me",
      kind: "personal",
      name: "Personal",
      detail: "Maya Okafor",
      initials: "MO",
      current: false,
      underReview: false,
    },
    {
      id: "north",
      kind: "organisation",
      name: "Northbank Gallery",
      detail: "Owner",
      initials: "NG",
      current: true,
      underReview: false,
    },
  ],
  pendingInvitations: 1,
  invitationsHref: "/organisations/invitations",
  registerHref: "/onboarding/organisation?fresh=1",
};

describe("AccountSwitcherSheet", () => {
  it("lists the accounts, invitations, LAX Account and Sign out under one title", () => {
    render(<AccountSwitcherSheet switcher={switcher} open onOpenChange={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Switch account" });
    expect(
      within(sheet).getByRole("button", { name: /Northbank Gallery.*current account/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(within(sheet).getByRole("link", { name: "Pending invitations (1)" })).toBeVisible();
    expect(within(sheet).getByRole("link", { name: /LAX Account/ })).toBeVisible();
    expect(within(sheet).getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
