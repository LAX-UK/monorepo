import { render, screen } from "@testing-library/react";
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

const clientUser = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  role: "client" as const,
  image: null,
};

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin User",
  role: "administrator" as const,
  image: null,
};

describe("AppShell", () => {
  it("renders public-site affordances for client dashboards", () => {
    render(
      <AppShell user={clientUser} shellRole="client">
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
      <AppShell user={adminUser} shellRole="admin">
        <p>Admin content</p>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /view public lax site/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /browse lax\.bid/i })).not.toBeInTheDocument();
  });
});
