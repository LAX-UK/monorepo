import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose: vi.fn() }),
}));
vi.mock("@/components/layout/acting-as-tooltip", () => ({
  ActingAsTooltip: ({ children }: { children: ReactNode }) => children,
}));

const { AccountSwitcher } = await import("./account-switcher");

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
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
