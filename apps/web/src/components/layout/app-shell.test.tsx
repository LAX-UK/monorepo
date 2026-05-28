import { buildShellConfig } from "@/lib/shell/build-shell-config";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
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
  staffRole: "super_admin" as const,
  image: null,
  emailVerified: true,
  emailStatus: "ok" as const,
};

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
    expect(screen.getAllByRole("link", { name: /browse lax\.bid/i })[0]).toHaveAttribute(
      "href",
      "/",
    );
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

  it("renders shell config slots in main landmark order", () => {
    render(
      <AppShell
        user={clientUser}
        config={buildShellConfig({
          user: clientUser,
          role: "client",
          headerRightSlot: <span>Header action</span>,
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

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("does not render the mobile hamburger and keeps display settings desktop-only", () => {
    render(
      <AppShell user={clientUser} config={buildShellConfig({ user: clientUser, role: "client" })}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(
      screen.queryByRole("button", { name: /open dashboard navigation/i }),
    ).not.toBeInTheDocument();

    const header = screen.getByRole("banner");
    const displaySettings = within(header).getByRole("button", { name: /open display settings/i });
    const themeToggle = within(header).getByRole("button", {
      name: /switch to (light|dark) theme/i,
    });
    expect(displaySettings.closest(".hidden")).not.toBeNull();
    expect(themeToggle.closest(".hidden")).not.toBeNull();
  });
});
