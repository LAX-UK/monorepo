import { BidPhoneMenu } from "@/components/layout/bid-phone-menu";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Switch to dark theme</button>,
}));

const FAMILY: LaxFamilyLinkVm[] = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "bid", label: "lax.bid", href: "/", current: true },
  { id: "account", label: "LAX Account", href: "https://account.lax.art", current: false },
];

function renderMenu() {
  render(
    <BidPhoneMenu
      open
      onOpenChange={() => {}}
      pathname="/"
      searchParams={new URLSearchParams()}
      sections={emptyMegaMenuSections()}
      familyLinks={FAMILY}
    />,
  );
  return within(screen.getByRole("dialog"));
}

describe("BidPhoneMenu", () => {
  it("opens with the Bid lockup and Close, then the LAX top bar row", () => {
    const menu = renderMenu();
    const header = screen.getByTestId("phone-menu-header");
    expect(within(header).getByRole("link", { name: "LAX Bid home" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    expect(menu.getByRole("navigation", { name: "LAX family menu" })).toBeInTheDocument();
  });

  it("lists About us, Contact us and FAQ as the help links", () => {
    const menu = renderMenu();
    const help = within(menu.getByRole("navigation", { name: "Help" }));
    expect(help.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "About us",
      "Contact us",
      "FAQ",
    ]);
  });

  it("puts Theme last, and has no search and no account", () => {
    const menu = renderMenu();
    const theme = screen.getByTestId("phone-menu-theme");
    expect(theme).toHaveTextContent("Theme");
    expect(menu.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(theme.parentElement?.lastElementChild).toBe(theme);
    expect(menu.queryByRole("button", { name: /search/i })).toBeNull();
    expect(menu.queryByText(/sign in|create account|sign out/i)).toBeNull();
    expect(menu.queryByText(/search lots/i)).toBeNull();
  });

  it("keeps the order: header, family row, main navigation, help, theme", () => {
    renderMenu();
    const dialog = screen.getByRole("dialog");
    const order = [
      screen.getByTestId("phone-menu-header"),
      within(dialog).getByRole("navigation", { name: "LAX family menu" }),
      within(dialog).getByRole("navigation", { name: "Main" }),
      within(dialog).getByRole("navigation", { name: "Help" }),
      screen.getByTestId("phone-menu-theme"),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(
        (order[i - 1] as Node).compareDocumentPosition(order[i] as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
