import type { AccountChrome, AccountOption } from "@/lib/navigation/account-switcher-model";
import {
  type WorkspaceAccessDenied,
  workspaceAccessDenied,
} from "@/lib/presenters/workspace-access/workspace-access";
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
  accountsHref: "/organisations",
  registerHref: "/onboarding/organisation?fresh=1",
};

function renderWith(
  current: AccountOption,
  switcher: AccountChrome["switcher"],
  denied: { page: string | null; openedBy: string | null; back?: WorkspaceAccessDenied["back"] },
  next = "/organisation/payouts",
) {
  render(
    <AccountChromeProvider account={{ current, switcher }}>
      <NoAccess next={next} denied={{ back: null, ...denied }} />
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
    renderWith(gallery, SWITCHER, { page: "Payouts", openedBy: null });
    expect(screen.queryByText(/My bids/)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });

  it("goes back to Consignments from a consignment, in either kind of account", () => {
    const next = "/selling/consignments/s1";
    renderWith(personal, SWITCHER, workspaceAccessDenied(next, null), next);
    expect(screen.getByRole("link", { name: "Back to Consignments" })).toHaveAttribute(
      "href",
      "/selling/consignments",
    );
    expect(screen.queryByText(/My bids/)).toBeNull();
  });

  it("goes back to Consignments from a consignment inside an organisation", () => {
    const next = "/selling/consignments/s1";
    renderWith(gallery, SWITCHER, workspaceAccessDenied(next, { role: "viewer" }), next);
    expect(screen.getByRole("link", { name: "Back to Consignments" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Back to Home" })).toBeNull();
  });

  it("keeps Back to My bids for a bid", () => {
    const next = "/bids/telephone/b1";
    renderWith(personal, SWITCHER, workspaceAccessDenied(next, null), next);
    expect(screen.getByRole("link", { name: "Back to My bids" })).toHaveAttribute("href", "/bids");
  });

  it("offers switching first when the page belongs to another account", () => {
    renderWith(personal, SWITCHER, { page: "this consignment", openedBy: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "You don't have access to this consignment",
    );
    expect(
      screen.getByText(
        "It isn't available in the account you're using. If it's in another of your accounts, switch to that one.",
      ),
    ).toBeVisible();
    const [first] = screen.getAllByRole("button");
    expect(first).toHaveAccessibleName(/Switch account/);
  });

  it("has no Switch account for someone with one account", () => {
    renderWith(personal, null, { page: null, openedBy: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You don't have access");
    expect(
      screen.getByText(
        "This page isn't available in your account. If someone sent you the link, check it with them.",
      ),
    ).toBeVisible();
    // Nothing suggests the page belongs to an organisation or that an owner could invite them.
    expect(screen.queryByText(/member of|invite you|owner/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Switch account/ })).toBeNull();
  });
});
