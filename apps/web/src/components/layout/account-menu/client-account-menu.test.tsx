import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { buildHeaderAccountMenu } from "@/lib/navigation/header-account-menu.vm";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ClientAccountMenu } from "./client-account-menu";

vi.mock("@/lib/auth/use-logout", () => ({
  useLogout: () => ({ logout: vi.fn(), pending: false }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const MEMBER_MENU = buildHeaderAccountMenu({
  scope: { context: { kind: "personal" }, hasSubmissions: true },
  accounts: [
    {
      id: "me",
      kind: "personal",
      name: "Personal",
      detail: "Jordan Hale",
      initials: "JH",
      current: true,
      underReview: false,
    },
    {
      id: "org-1",
      kind: "organisation",
      name: "Northgate Collection Ltd",
      detail: "Buyer",
      initials: "NC",
      current: false,
      underReview: false,
    },
  ],
  pendingInvitations: 0,
  attention: { ...NO_ATTENTION, outbidLots: ["14"], paymentsDue: 1 },
  pathname: "/bids",
});

function renderMenu() {
  render(
    <div role="menu" aria-label="Account">
      <ClientAccountMenu menu={MEMBER_MENU} surface="popover" onNavigate={() => {}} />
    </div>,
  );
  return screen.getByRole("menu", { name: "Account" });
}

describe("ClientAccountMenu", () => {
  it("lists the person's accounts, the one in use marked Here and the others to open", () => {
    const accounts = within(renderMenu()).getByRole("group", { name: "Your accounts" });
    expect(within(accounts).getByRole("menuitem", { name: /Personal.*Here/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      within(accounts).getByRole("menuitem", { name: /Northgate Collection Ltd.*Open/ }),
    ).toHaveAttribute("href", "/switch-account?to=org-1&next=%2Fhome");
  });

  it("marks the page in view and reads out what is due", () => {
    const buying = within(renderMenu()).getByRole("group", { name: "Buying" });
    expect(within(buying).getByRole("menuitem", { name: /My bids.*1 outbid/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(buying).getByRole("menuitem", { name: /Purchases.*1 to pay/ })).toBeVisible();
  });

  it("ends with LAX Account (out of Bid) and Sign out", () => {
    const menu = renderMenu();
    expect(within(menu).getByRole("menuitem", { name: "LAX Account" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    const items = within(menu).getAllByRole("menuitem");
    expect(items.at(-1)).toHaveTextContent("Sign out");
  });
});
