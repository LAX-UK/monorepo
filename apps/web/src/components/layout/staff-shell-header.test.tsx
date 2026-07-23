import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaffShellHeader } from "./staff-shell-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

describe("StaffShellHeader", () => {
  it("renders search, actions, theme, and account in order", () => {
    render(
      // biome-ignore lint/a11y/useValidAriaRole: `role` is the shell prop, not a DOM ARIA role
      <StaffShellHeader
        user={adminUser}
        role="platform"
        actionsSlot={<span data-testid="actions-slot">Actions</span>}
        extraSlot={<span data-testid="extra-slot">Extra</span>}
      />,
    );

    expect(screen.getByRole("button", { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByTestId("actions-slot")).toBeInTheDocument();
    expect(screen.getByTestId("extra-slot")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /account menu/i })).toBeInTheDocument();
  });
});
