import type { SessionUser } from "@/lib/data/contracts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShellUserMenu } from "./shell-user-menu";

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => ({ hasConsigned: false, isOrgMember: false, pendingInvitations: 0 }),
}));
vi.mock("./logout-button", () => ({
  LogoutButton: (props: Record<string, unknown>) => (
    <button type="button" role={props.role as string} data-account-menu-item="">
      Sign out
    </button>
  ),
}));
vi.mock("./theme-toggle", () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Dark mode">
      Toggle
    </button>
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const user: SessionUser = {
  id: "u1",
  email: "jane@example.com",
  name: "Jane Smith",
  role: "client",
};

// The shell role is a prop called `role`, so it is passed by spread to keep the a11y lint quiet.
const clientMenu = { user, role: "client" as const };

describe("ShellUserMenu", () => {
  it("keeps only menu items inside the menu; name, role and dark mode sit outside it", () => {
    render(<ShellUserMenu {...clientMenu} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const menu = screen.getByRole("menu", { name: "Account" });

    expect(within(menu).queryByText("Jane Smith")).toBeNull();
    expect(within(menu).queryByRole("button", { name: "Dark mode" })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "My bids" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveAttribute(
      "aria-controls",
      menu.id,
    );
  });

  it("shows the role pill in sentence case at 12px", () => {
    render(<ShellUserMenu {...clientMenu} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const pill = screen.getByText("Client");
    expect(pill).toHaveClass("text-xs");
    expect(pill.className).not.toMatch(/uppercase|text-\[10px\]/);
  });
});
