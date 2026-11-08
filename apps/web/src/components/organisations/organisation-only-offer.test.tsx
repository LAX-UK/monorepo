import { AccountChromeProvider } from "@/components/layout/account-switcher/account-chrome-context";
import { buildAccountChrome } from "@/lib/navigation/account-switcher-model";
import { ORGANISATION_ONLY_PAGES } from "@/lib/organisations/organisation-only-page.vm";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({ switchActingLegalEntity: vi.fn() }));
vi.mock("@/lib/legal-entity/account-switch-channel", () => ({ announceAccountSwitch: vi.fn() }));

import { OrganisationOnlyOffer } from "./organisation-only-offer";

function member(id: string, kind: "individual" | "organisation", displayName: string) {
  return {
    id,
    displayName,
    kind,
    subkind: kind === "individual" ? "private_collector" : "gallery",
    status: "approved",
    role: "owner",
    isPrimaryAdmin: true,
  } as const;
}

function renderOffer(organisations: string[]) {
  const account = buildAccountChrome({
    personName: "Oliver Grant",
    memberships: [
      member("me", "individual", "Oliver Grant"),
      ...organisations.map((name, i) => member(`org-${i + 1}`, "organisation", name)),
    ],
    actingId: "me",
    orgModuleEnabled: true,
    pendingInvitations: 0,
  });
  render(
    <AccountChromeProvider account={account}>
      <OrganisationOnlyOffer page={ORGANISATION_ONLY_PAGES.team} />
    </AccountChromeProvider>,
  );
}

describe("OrganisationOnlyOffer", () => {
  it("offers a one-tap switch for one organisation, as a link that opens the page in it", () => {
    renderOffer(["Northbank Gallery"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Team belongs to Northbank Gallery" }),
    ).toBeVisible();
    // Without scripts the anchor still works, as a page load through the switch hop.
    expect(screen.getByRole("link", { name: "Switch to Northbank Gallery" })).toHaveAttribute(
      "href",
      "/team?account=org-1",
    );
    expect(screen.getByRole("link", { name: "Back to My bids" })).toHaveAttribute("href", "/bids");
  });

  it("offers the account switcher for two organisations", () => {
    renderOffer(["Northbank Gallery", "Cedar & Stone"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Team belongs to an organisation" }),
    ).toBeVisible();
    expect(screen.getByTestId("no-access-switch")).toHaveTextContent("Switch account");
    expect(screen.queryByRole("link", { name: /^Switch to/ })).toBeNull();
  });
});
