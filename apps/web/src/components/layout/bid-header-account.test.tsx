import { BidHeaderAccount } from "@/components/layout/bid-header-account";
import type { BidAttention } from "@/hooks/use-bid-attention";
import type { SessionUser } from "@/lib/data/contracts";
import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { buildHeaderAccountMenu } from "@/lib/navigation/header-account-menu.vm";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let user: SessionUser | null = null;
let pending = false;
let isLg = true;
let attention: BidAttention;

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user, pending }),
}));
vi.mock("@/hooks/use-is-lg", () => ({ useIsLg: () => isLg }));
vi.mock("@/hooks/use-bid-attention", () => ({ useBidAttention: () => attention }));
vi.mock("next/navigation", () => ({ usePathname: () => "/sales" }));
vi.mock("@/lib/auth/use-auth-header-links", () => ({
  useAuthHeaderLinks: () => ({
    signInHref: "/api/auth/login?next=%2Fsales",
    registerHref: "/api/auth/login?next=%2Fsales&intent=signup",
  }),
}));
vi.mock("@/lib/auth/use-logout", () => ({
  useLogout: () => ({ logout: vi.fn(), pending: false }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/account-menu/use-header-account-menu", () => ({
  useHeaderAccountMenu: () => ({
    kind: "client",
    chip: attention.chip,
    menu: buildHeaderAccountMenu({
      scope: { context: { kind: "personal" }, hasSubmissions: false },
      accounts: null,
      pendingInvitations: 0,
      attention: NO_ATTENTION,
      pathname: "/sales",
    }),
  }),
}));

const USER = {
  id: "u1",
  name: "Jordan Hale",
  email: "jordan@example.com",
  role: "client",
} as unknown as SessionUser;

const QUIET: BidAttention = {
  signedIn: true,
  viewer: { displayName: USER.name, email: USER.email },
  pending: false,
  attention: null,
  chip: null,
};

beforeEach(() => {
  user = null;
  pending = false;
  isLg = true;
  attention = QUIET;
});

const open = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });

describe("BidHeaderAccount signed out", () => {
  it("shows Account, with Sign in and Create account in its menu", () => {
    render(<BidHeaderAccount />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("Account");
    open(trigger);
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/api/auth/login?next=%2Fsales",
    );
    expect(screen.getByRole("menuitem", { name: "Create account" })).toHaveAttribute(
      "href",
      "/api/auth/login?next=%2Fsales&intent=signup",
    );
  });

  it("shows a loading placeholder while the session is read", () => {
    pending = true;
    render(<BidHeaderAccount />);
    expect(screen.getByRole("status", { name: "Loading account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Account/ })).toBeNull();
  });
});

describe("BidHeaderAccount signed in", () => {
  beforeEach(() => {
    user = USER;
  });

  it("shows the avatar and first name only, and opens Bid's account menu as a dropdown from 1024px", () => {
    render(<BidHeaderAccount />);
    const trigger = screen.getByRole("button", { name: "Account menu, Jordan Hale" });
    expect(within(trigger).getByTestId("account-entry-name")).toHaveTextContent("Jordan");
    open(trigger);
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /bids/i })).toHaveAttribute("href", "/bids");
    expect(screen.queryByTestId("account-sheet")).toBeNull();
  });

  it("opens the same items in the account sheet from 768 to 1023px", () => {
    isLg = false;
    render(<BidHeaderAccount />);
    open(screen.getByRole("button", { name: "Account menu, Jordan Hale" }));
    const sheet = within(screen.getByTestId("account-sheet"));
    expect(sheet.getByText("Jordan Hale")).toBeInTheDocument();
    expect(sheet.getByRole("link", { name: /bids/i })).toHaveAttribute("href", "/bids");
    expect(sheet.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows no dot when nothing needs the person", () => {
    render(<BidHeaderAccount />);
    expect(screen.queryByTestId("account-entry-attention")).toBeNull();
  });

  it("shows a dot for the chip's prompts", () => {
    attention = {
      ...QUIET,
      chip: { kind: "payment-due", label: "Payment due", href: "/purchases", accessibleName: "x" },
    };
    render(<BidHeaderAccount />);
    expect(screen.getByTestId("account-entry-attention")).toBeInTheDocument();
  });

  it("shows a dot for unread notifications, which are reached from the account", () => {
    attention = { ...QUIET, attention: { ...NO_ATTENTION, unreadNotifications: 2 } };
    render(<BidHeaderAccount />);
    expect(screen.getByTestId("account-entry-attention")).toBeInTheDocument();
  });
});
