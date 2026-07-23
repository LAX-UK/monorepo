import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientShellHeader } from "./client-shell-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/components/layout/app-shell-breadcrumbs", () => ({
  AppShellBreadcrumbs: () => null,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: { href: string; children: React.ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

describe("ClientShellHeader", () => {
  it("renders injected slots and account menu", () => {
    render(
      // biome-ignore lint/a11y/useValidAriaRole: `role` is the shell prop, not a DOM ARIA role
      <ClientShellHeader
        user={clientUser}
        role="client"
        clientWorkspaceMode="buying"
        actionsSlot={<span data-testid="client-actions">Client actions</span>}
      />,
    );

    expect(screen.getByTestId("client-actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /account menu/i })).toBeInTheDocument();
  });
});
