import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose: vi.fn() }),
}));

const { AccountChromeProvider } = await import("./account-chrome-context");
const { NoAccess } = await import("./no-access");

const option = {
  id: "me",
  kind: "personal" as const,
  name: "Personal",
  detail: "Jane Smith",
  initials: "JS",
  current: true,
};

function renderWith(switcher: AccountChrome["switcher"]) {
  render(
    <AccountChromeProvider account={{ current: option, switcher, strip: null }}>
      <NoAccess next="/selling/consignments/s1" />
    </AccountChromeProvider>,
  );
}

describe("NoAccess", () => {
  it("says plainly that the page is out of reach", () => {
    renderWith(null);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You don't have access");
    expect(screen.getByRole("link", { name: "Go to My bids" })).toHaveAttribute("href", "/bids");
  });

  it("offers Switch account to someone with more than one account", () => {
    renderWith({
      options: [option],
      pendingInvitations: 0,
      invitationsHref: "/organisations/invitations",
      registerHref: "/onboarding/organisation?fresh=1",
    });
    expect(screen.getByRole("button", { name: /Switch account/ })).toBeInTheDocument();
  });

  it("has no Switch account for someone with one account", () => {
    renderWith(null);
    expect(screen.queryByRole("button", { name: /Switch account/ })).toBeNull();
  });
});
