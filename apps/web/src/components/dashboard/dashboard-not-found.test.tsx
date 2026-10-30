import { AccountChromeProvider } from "@/components/layout/account-switcher/account-chrome-context";
import type { AccountOption } from "@/lib/navigation/account-switcher-model";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardNotFound } from "./dashboard-not-found";

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

function renderAs(current: AccountOption) {
  render(
    <AccountChromeProvider account={{ current, switcher: null }}>
      <DashboardNotFound />
    </AccountChromeProvider>,
  );
}

describe("DashboardNotFound", () => {
  it("leads back to My bids for a personal account", () => {
    renderAs(personal);
    expect(screen.getByRole("link", { name: "Back to My bids" })).toHaveAttribute("href", "/bids");
  });

  it("leads back to Home, never My bids, inside an organisation", () => {
    renderAs(gallery);
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/home");
    expect(screen.queryByText(/My bids/)).toBeNull();
  });
});
