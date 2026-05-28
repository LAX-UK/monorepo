import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import { buildShellConfig } from "@/lib/shell/build-shell-config";
import { ShellChromeProvider } from "@/lib/shell/shell-chrome-context";
import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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

function renderAppShellBreadcrumbs(ui: ReactNode) {
  const config = buildShellConfig({ user: clientUser, role: "client" });
  return render(
    <ShellConfigProvider config={config}>
      <ShellChromeProvider>{ui}</ShellChromeProvider>
    </ShellConfigProvider>,
  );
}

describe("AppShellBreadcrumbs", () => {
  it("renders mobile shell title for section routes", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/watchlist");

    // biome-ignore lint/a11y/useValidAriaRole: `role` is the shell prop, not a DOM ARIA role
    renderAppShellBreadcrumbs(<AppShellBreadcrumbs role="client" sessionUser={clientUser} />);

    expect(screen.getByRole("heading", { name: "Watchlist" })).toBeInTheDocument();
  });

  it("renders desktop breadcrumb trail", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/watchlist");

    // biome-ignore lint/a11y/useValidAriaRole: `role` is the shell prop, not a DOM ARIA role
    renderAppShellBreadcrumbs(<AppShellBreadcrumbs role="client" sessionUser={clientUser} />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});
