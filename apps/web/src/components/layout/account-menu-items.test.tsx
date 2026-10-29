import type { SessionUser } from "@/lib/data/contracts";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import type { AccountMenuContext } from "@/lib/navigation/account-menu-context";
import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { PERSONAL_NAV_SCOPE } from "@/lib/navigation/client-nav-model";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenuItems, useAccountMenuGroups } from "./account-menu-items";

const contextMock = vi.fn<() => AccountMenuContext | null>();

vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => contextMock(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const user: SessionUser = {
  id: "user-1",
  email: "buyer@example.com",
  name: "Buyer",
  role: "client",
};

function Menu({ menu = true }: { menu?: boolean }) {
  const groups = useAccountMenuGroups(user, true);
  return (
    <div role={menu ? "menu" : undefined}>
      <AccountMenuItems groups={groups} variant="header" menu={menu} onNavigate={() => {}} />
    </div>
  );
}

const withContext = (overrides: Partial<AccountMenuContext> = {}) =>
  contextMock.mockReturnValue({
    hasConsigned: false,
    isOrgMember: false,
    pendingInvitations: 0,
    scope: PERSONAL_NAV_SCOPE,
    accounts: null,
    attention: NO_ATTENTION,
    ...overrides,
  });

describe("AccountMenuItems", () => {
  beforeEach(() => {
    contextMock.mockReset();
  });

  it("shows the everyday pages first and no Dashboard item", () => {
    withContext();
    render(<Menu />);
    const names = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(names.slice(0, 4)).toEqual(["My bids", "Purchases", "Watching", "Notifications"]);
    expect(names).not.toContain("Dashboard");
  });

  it("offers Sell with LAX to a buyer who has never consigned", () => {
    withContext();
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "Sell with LAX" })).toHaveAttribute(
      "href",
      "/selling/new",
    );
    expect(screen.queryByRole("menuitem", { name: "Your organisations" })).toBeNull();
  });

  it("offers Selling and Your organisations to an organisation member", () => {
    withContext({ isOrgMember: true });
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "Selling" })).toHaveAttribute(
      "href",
      "/selling/consignments",
    );
    expect(screen.getByRole("menuitem", { name: "Your organisations" })).toBeInTheDocument();
  });

  it("always links LAX Account to the Account origin", () => {
    withContext();
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "LAX Account" })).toHaveAttribute(
      "href",
      laxAccountHomeUrl(),
    );
    expect(screen.getByRole("menuitem", { name: "Bid settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("falls back to safe defaults until the person's facts load", () => {
    contextMock.mockReturnValue(null);
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "Sell with LAX" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "LAX Account" })).toBeInTheDocument();
  });

  it("separates the groups", () => {
    withContext();
    render(<Menu />);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });

  it("renders a plain list for the mobile drawer", () => {
    withContext();
    render(<Menu menu={false} />);
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getByRole("link", { name: "Purchases" })).toHaveAttribute("href", "/purchases");
  });
});
