import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose: vi.fn() }),
}));
vi.mock("@/components/layout/acting-as-tooltip", () => ({ ActingAsTooltip: () => null }));

const { AccountSwitcher } = await import("./account-switcher");
const { AccountStrip } = await import("./account-strip");

const current = {
  id: "northbank",
  kind: "organisation" as const,
  name: "Northbank Gallery",
  detail: "Admin",
  initials: "NG",
  current: true,
  underReview: false,
};

const withOrganisations: AccountChrome = {
  current,
  switcher: {
    options: [current],
    pendingInvitations: 0,
    invitationsHref: "/organisations/invitations",
    registerHref: "/onboarding/organisation?fresh=1",
  },
  strip: { name: "Northbank Gallery", role: "Admin" },
};

describe("AccountSwitcher", () => {
  it("shows the account in use with the person's role", () => {
    render(<AccountSwitcher account={withOrganisations} />);
    const trigger = screen.getByTestId("account-switcher");
    expect(trigger).toHaveTextContent("Northbank Gallery");
    expect(trigger).toHaveTextContent("Admin");
    expect(trigger).toHaveAccessibleName("Account: Northbank Gallery, Admin. Switch account");
  });

  it("renders nothing for someone with no organisation", () => {
    const { container } = render(
      <AccountSwitcher
        account={{
          current: { ...current, kind: "personal", name: "Personal", detail: "Jane Smith" },
          switcher: null,
          strip: null,
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AccountStrip", () => {
  it("names the organisation and role, and says what it means to screen readers", () => {
    render(<AccountStrip strip={{ name: "Northbank Gallery", role: "Admin" }} />);
    expect(screen.getByTestId("account-strip")).toHaveTextContent(
      "Using Bid asNorthbank Gallery·Admin",
    );
  });
});
