import { buildShellConfig } from "@/lib/shell/build-shell-config";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const pathnameMock = vi.hoisted(() => ({ current: "/bids" }));

vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.current,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

vi.mock("./command-palette-lazy", () => ({
  CommandPaletteLazy: () => null,
}));

vi.mock("@/hooks/use-unread-notifications", () => ({
  useUnreadNotifications: () => ({
    items: [],
    setItems: () => {},
    loaded: true,
    unread: 0,
    refresh: async () => {},
  }),
}));

vi.mock("@/lib/socket", () => ({
  getSocket: () => ({ emit: () => {}, on: () => {}, off: () => {} }),
}));

vi.mock("@/lib/actions/user-ui-preferences", () => ({
  syncUiThemeFromClientAction: vi.fn(),
  updateUiPreferencesAction: vi.fn(),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: null, pending: false }),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => async () => {},
}));

const clientUser = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  role: "client" as const,
  image: null,
  emailVerified: true,
  emailStatus: "ok" as const,
};

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin User",
  role: "staff" as const,
  staffRole: "administrator" as const,
  image: null,
  emailVerified: true,
  emailStatus: "ok" as const,
};

const FAMILY_LINKS = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "shop", label: "lax.shop", href: "https://shop.lax.art", current: false },
  { id: "bid", label: "lax.bid", href: "https://lax.bid", current: true },
  { id: "account", label: "LAX Account", href: "https://account.lax.bid/account", current: false },
] as const;

describe("AppShell", () => {
  it("renders public-site affordances for client dashboards", () => {
    render(
      <AppShell user={clientUser} config={buildShellConfig({ user: clientUser, role: "client" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /view public lax site/i })).toHaveAttribute(
      "href",
      "/",
    );

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menuitem", { name: "My bids" })).toHaveAttribute("href", "/bids");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    // Appearance lives in Bid settings; only a compact dark-mode toggle stays in the menu.
    expect(screen.queryByText("Display settings")).not.toBeInTheDocument();
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
  });

  it("does not render public-site affordances for staff shells", () => {
    render(
      <AppShell user={adminUser} config={buildShellConfig({ user: adminUser, role: "platform" })}>
        <p>Admin content</p>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /view public lax site/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /browse lax\.bid/i })).not.toBeInTheDocument();
  });

  it("runs the LAX top bar across a client shell, with Bid marked current", () => {
    render(
      <AppShell
        user={clientUser}
        config={buildShellConfig({ user: clientUser, role: "client", familyLinks: FAMILY_LINKS })}
      >
        <p>Dashboard content</p>
      </AppShell>,
    );

    const bar = screen.getByTestId("lax-family-bar");
    expect(within(bar).getByRole("link", { name: "lax.bid" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(within(bar).getByRole("link", { name: "LAX Account" })).toBeInTheDocument();
  });

  it("keeps the LAX top bar off staff shells", () => {
    render(
      <AppShell
        user={adminUser}
        config={buildShellConfig({ user: adminUser, role: "platform", familyLinks: FAMILY_LINKS })}
      >
        <p>Admin content</p>
      </AppShell>,
    );

    expect(screen.queryByTestId("lax-family-bar")).not.toBeInTheDocument();
  });

  it("renders shell config slots in main landmark order", () => {
    render(
      <AppShell
        user={clientUser}
        config={buildShellConfig({
          user: clientUser,
          role: "client",
          headerActionsSlot: <span>Header action</span>,
          topSlot: <p>Top notice</p>,
          contextBanner: <p>Context banner</p>,
        })}
      >
        <p>Dashboard content</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");
    expect(screen.getByText("Top notice")).toBeInTheDocument();
    expect(screen.getByText("Context banner")).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(screen.getByText("Header action")).toBeInTheDocument();

    const top = screen.getByText("Top notice");
    const banner = screen.getByText("Context banner");
    const content = screen.getByText("Dashboard content");
    expect(main.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(top.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives every workspace page, its breadcrumbs and notices one content column", () => {
    render(
      <AppShell
        user={clientUser}
        config={buildShellConfig({
          user: clientUser,
          role: "client",
          contextBanner: <p>Context banner</p>,
        })}
      >
        <p>Dashboard content</p>
      </AppShell>,
    );
    const column = screen.getByRole("main").firstElementChild as HTMLElement;
    expect(column.style.getPropertyValue("--workspace-page-max")).toBe("64rem");
    expect(
      screen.getByText("Context banner").closest("div.max-w-\\[var\\(--workspace-page-max\\)\\]"),
    ).not.toBeNull();
  });

  it("keeps staff pages at the full width", () => {
    render(
      <AppShell user={adminUser} config={buildShellConfig({ user: adminUser, role: "platform" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );
    const column = screen.getByRole("main").firstElementChild as HTMLElement;
    expect(column.style.getPropertyValue("--workspace-page-max")).toBe("");
  });

  it("ignores a stored density in the organisation workspace", () => {
    // A compact choice left in this browser from before.
    const stored = { getItem: () => "compact", setItem: vi.fn(), removeItem: vi.fn() };
    Object.defineProperty(window, "localStorage", { value: stored, configurable: true });
    delete document.documentElement.dataset.dashboardDensity;
    render(
      <AppShell
        user={clientUser}
        config={buildShellConfig({ user: clientUser, role: "client" })}
        cookieDensity="compact"
      >
        <p>Dashboard content</p>
      </AppShell>,
    );
    const column = screen.getByRole("main").firstElementChild as HTMLElement;
    expect(column.dataset.density).toBe("normal");
    expect(document.documentElement.dataset.dashboardDensity).toBeUndefined();
    expect(stored.setItem).not.toHaveBeenCalled();
  });

  it("keeps the staff density", () => {
    render(
      <AppShell
        user={adminUser}
        config={buildShellConfig({ user: adminUser, role: "platform" })}
        cookieDensity="compact"
      >
        <p>Dashboard content</p>
      </AppShell>,
    );
    const column = screen.getByRole("main").firstElementChild as HTMLElement;
    expect(column.dataset.density).toBe("compact");
    delete document.documentElement.dataset.dashboardDensity;
  });

  it("never remounts the page when the shell around it changes", () => {
    const mounts = vi.fn();
    function Page() {
      useEffect(() => mounts(), []);
      return <p>Dashboard content</p>;
    }
    const shell = (extra: Partial<Parameters<typeof buildShellConfig>[0]>) => (
      <AppShell
        user={clientUser}
        config={buildShellConfig({ user: clientUser, role: "client", ...extra })}
      >
        <Page />
      </AppShell>
    );
    const { rerender } = render(shell({ contextBanner: <p>Switched to Northbank Gallery</p> }));
    // The one-time notice goes, a top slot arrives, the shell config is rebuilt.
    rerender(shell({}));
    rerender(shell({ topSlot: <p>Welcome back</p> }));
    rerender(shell({ hideBottomTabBar: true }));
    expect(mounts).toHaveBeenCalledOnce();
  });

  it("renders client bottom tab bar from mobileNav", () => {
    render(
      <AppShell user={clientUser} config={buildShellConfig({ user: clientUser, role: "client" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );
    expect(
      screen.getByRole("navigation", { name: /primary mobile dashboard navigation/i }),
    ).toBeInTheDocument();
  });

  it("hides client bottom tab bar when hideBottomTabBar is set on config", () => {
    render(
      <AppShell
        user={clientUser}
        config={{
          ...buildShellConfig({ user: clientUser, role: "client" }),
          hideBottomTabBar: true,
        }}
      >
        <p>Dashboard content</p>
      </AppShell>,
    );
    expect(
      screen.queryByRole("navigation", { name: /primary mobile dashboard navigation/i }),
    ).not.toBeInTheDocument();
  });

  it("renders mobile shell title in the header region", () => {
    render(
      <AppShell user={clientUser} config={buildShellConfig({ user: clientUser, role: "client" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { name: "My bids" })).toBeInTheDocument();
  });

  it("does not render the mobile hamburger and uses a unified account menu", () => {
    render(
      <AppShell user={clientUser} config={buildShellConfig({ user: clientUser, role: "client" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(
      screen.queryByRole("button", { name: /open dashboard navigation/i }),
    ).not.toBeInTheDocument();

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: /account menu/i })).toBeInTheDocument();
    expect(
      within(header).queryByRole("button", { name: /open display settings/i }),
    ).not.toBeInTheDocument();
    expect(
      within(header).queryByRole("button", { name: /switch to (light|dark) theme/i }),
    ).not.toBeInTheDocument();
  });

  it("does not duplicate user identity in the sidebar footer", () => {
    render(
      <AppShell user={clientUser} config={buildShellConfig({ user: clientUser, role: "client" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(screen.queryByText("client@example.com")).not.toBeInTheDocument();
  });

  it("keeps workspace switching in the sidebar", () => {
    render(
      <AppShell user={adminUser} config={buildShellConfig({ user: adminUser, role: "platform" })}>
        <p>Admin content</p>
      </AppShell>,
    );

    expect(screen.getByRole("navigation", { name: /gallery/i })).toBeInTheDocument();
  });

  it("renders staff shell header with left search and theme toggle", () => {
    render(
      <AppShell user={adminUser} config={buildShellConfig({ user: adminUser, role: "platform" })}>
        <p>Admin content</p>
      </AppShell>,
    );

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: /^search$/i })).toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: /open search/i })).not.toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: /open command palette/i }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });
});
