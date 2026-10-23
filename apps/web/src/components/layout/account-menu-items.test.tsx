import type { SessionUser } from "@/lib/data/contracts";
import type { AccountMenuContext } from "@/lib/navigation/account-menu-context";
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

function Menu({ mode = "buying", menu = true }: { mode?: "buying" | "selling"; menu?: boolean }) {
  const groups = useAccountMenuGroups(user, mode, true);
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
    accountOrigin: "https://account.example.test",
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

  it("offers Start selling to a buyer who has never consigned", () => {
    withContext();
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "Start selling" })).toHaveAttribute(
      "href",
      "/dashboard/submissions/new",
    );
    expect(screen.queryByRole("menuitem", { name: "Your organisations" })).toBeNull();
  });

  it("offers Selling and Your organisations to an organisation member", () => {
    withContext({ isOrgMember: true });
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "Selling" })).toHaveAttribute(
      "href",
      "/dashboard/seller",
    );
    expect(screen.getByRole("menuitem", { name: "Your organisations" })).toBeInTheDocument();
  });

  it("offers a way back to buying while selling", () => {
    withContext({ hasConsigned: true });
    render(<Menu mode="selling" />);
    expect(screen.getByRole("menuitem", { name: "Back to buying" })).toHaveAttribute(
      "href",
      "/dashboard/bids",
    );
  });

  it("links LAX Account to the configured origin and hides it when unset", () => {
    withContext();
    const { unmount } = render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "LAX Account" })).toHaveAttribute(
      "href",
      "https://account.example.test/account?from=bid",
    );
    unmount();

    withContext({ accountOrigin: null });
    render(<Menu />);
    expect(screen.queryByRole("menuitem", { name: "LAX Account" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Bid settings" })).toBeInTheDocument();
  });

  it("falls back to safe defaults until the person's facts load", () => {
    contextMock.mockReturnValue(null);
    render(<Menu />);
    expect(screen.getByRole("menuitem", { name: "Start selling" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "LAX Account" })).toBeNull();
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
    expect(screen.getByRole("link", { name: "Purchases" })).toHaveAttribute(
      "href",
      "/dashboard/purchases",
    );
  });
});
