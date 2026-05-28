import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { usePathname } from "next/navigation";

const clientUser = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  role: "client" as const,
  image: null,
  emailVerified: true,
  emailStatus: "ok" as const,
};

describe("AppShellBreadcrumbs", () => {
  it("renders mobile shell title for section routes", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/watchlist");

    // biome-ignore lint/a11y/useValidAriaRole: `role` is the shell prop, not a DOM ARIA role
    render(<AppShellBreadcrumbs role="client" sessionUser={clientUser} />);

    expect(screen.getByRole("heading", { name: "Watchlist" })).toBeInTheDocument();
  });

  it("renders desktop breadcrumb trail", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/watchlist");

    // biome-ignore lint/a11y/useValidAriaRole: `role` is the shell prop, not a DOM ARIA role
    render(<AppShellBreadcrumbs role="client" sessionUser={clientUser} />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});
