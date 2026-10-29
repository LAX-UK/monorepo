import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HeaderAuthChip } from "./header-auth-chip";

const useAppSessionMock = vi.fn();

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => useAppSessionMock(),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/use-auth-header-links", () => ({
  useAuthHeaderLinks: () => ({
    signInHref: "/api/auth/login?next=%2Fdashboard",
    registerHref: "/api/auth/login?next=%2Fdashboard&intent=signup",
  }),
}));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; sizes?: string }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
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

vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => null,
}));

const { isLgMock } = vi.hoisted(() => ({ isLgMock: vi.fn(() => true) }));

vi.mock("@/hooks/use-is-lg", () => ({
  useIsLg: () => isLgMock(),
}));

vi.mock("./notification-bell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

const clientUser = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  role: "client" as const,
  image: null,
};

describe("HeaderAuthChip", () => {
  it("renders a loading skeleton while the session resolves", () => {
    useAppSessionMock.mockReturnValue({ user: null, pending: true });

    render(<HeaderAuthChip variant="account" />);

    expect(screen.getByLabelText("Loading account")).toHaveAttribute("aria-busy", "true");
  });

  it("renders the guest account menu when signed out", () => {
    useAppSessionMock.mockReturnValue({ user: null, pending: false });

    render(<HeaderAuthChip variant="account" />);

    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /log in/i })).not.toBeInTheDocument();
  });

  it("opens the grouped account menu on wide screens before the person's facts load", () => {
    isLgMock.mockReturnValue(true);
    useAppSessionMock.mockReturnValue({ user: clientUser, pending: false });

    render(<HeaderAuthChip variant="account" />);

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByText("Client User")).toBeInTheDocument();
    expect(screen.getByText("client@example.com")).toBeInTheDocument();
    const menu = screen.getByRole("menu", { name: "Account" });
    expect(within(menu).getByRole("group", { name: "Buying" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "My bids" })).toHaveAttribute(
      "href",
      "/bids",
    );
    expect(within(menu).queryByRole("menuitem", { name: /home/i })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Sell a work" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    expect(within(menu).queryByRole("group", { name: "Your accounts" })).not.toBeInTheDocument();
  });

  it("opens an account-only sheet on phones", () => {
    isLgMock.mockReturnValue(false);
    useAppSessionMock.mockReturnValue({ user: clientUser, pending: false });

    render(<HeaderAuthChip variant="account" />);

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    const sheet = screen.getByRole("dialog", { name: "Your account" });
    expect(within(sheet).getByRole("link", { name: "Purchases" })).toHaveAttribute(
      "href",
      "/purchases",
    );
    expect(within(sheet).queryByRole("menu")).not.toBeInTheDocument();
    expect(within(sheet).queryByText(/auctions/i)).not.toBeInTheDocument();
  });
});
