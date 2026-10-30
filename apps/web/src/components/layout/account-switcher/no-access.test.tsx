import type { AccountChrome, AccountOption } from "@/lib/navigation/account-switcher-model";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose: vi.fn() }),
}));

const { AccountChromeProvider } = await import("./account-chrome-context");
const { NoAccess } = await import("./no-access");

const personal: AccountOption = {
  id: "me",
  kind: "personal",
  name: "Personal",
  detail: "Jane Smith",
  initials: "JS",
  current: true,
  underReview: false,
};
const gallery: AccountOption = {
  id: "org-1",
  kind: "organisation",
  name: "Northbank Gallery",
  detail: "Viewer",
  initials: "NG",
  current: true,
  underReview: false,
};
const SWITCHER: AccountChrome["switcher"] = {
  options: [personal, gallery],
  pendingInvitations: 0,
  invitationsHref: "/organisations/invitations",
  registerHref: "/onboarding/organisation?fresh=1",
};

function renderWith(
  current: AccountOption,
  switcher: AccountChrome["switcher"],
  denied: { page: string | null; openedBy: string | null },
) {
  render(
    <AccountChromeProvider account={{ current, switcher }}>
      <NoAccess next="/organisation/payouts" denied={denied} />
    </AccountChromeProvider>,
  );
}

describe("NoAccess", () => {
  it("names the page and who can open it, with Back to Home inside an organisation", () => {
    renderWith(gallery, SWITCHER, { page: "Payouts", openedBy: "Owners, admins and finance" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "You don't have access to Payouts",
    );
    expect(screen.getByText(/^Owners, admins and finance can open it\./)).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/home");
    expect(screen.queryByText(/My bids/)).toBeNull();
    // The role is the reason, so going back comes first and switching is the alternative.
    expect(screen.getByRole("button", { name: /Switch account/ })).toBeInTheDocument();
  });

  it("never says Go to My bids inside an organisation", () => {
    renderWith(gallery, SWITCHER, { page: "this consignment", openedBy: null });
    expect(screen.queryByText(/My bids/)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });

  it("offers switching first when the page belongs to another account", () => {
    renderWith(personal, SWITCHER, { page: "this consignment", openedBy: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "You don't have access to this consignment",
    );
    expect(screen.getByText(/It belongs to an account you aren't using/)).toBeVisible();
    const [first] = screen.getAllByRole("button");
    expect(first).toHaveAccessibleName(/Switch account/);
    expect(screen.getByRole("link", { name: "Back to My bids" })).toHaveAttribute("href", "/bids");
  });

  it("has no Switch account for someone with one account", () => {
    renderWith(personal, null, { page: null, openedBy: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You don't have access");
    expect(
      screen.getByText(/This page belongs to an organisation you aren't a member of/),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Switch account/ })).toBeNull();
  });
});
