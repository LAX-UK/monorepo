import type { SessionUser } from "@/lib/data/contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  describe("with an organisation", () => {
    const personal = {
      id: "me",
      kind: "personal",
      name: "Personal",
      detail: "Jane Smith",
      initials: "JS",
      current: false,
      underReview: false,
    } as const;
    const northbank = {
      id: "org-1",
      kind: "organisation",
      name: "Northbank Gallery",
      detail: "Owner",
      initials: "NG",
      current: true,
      underReview: false,
    } as const;
    const account = {
      current: northbank,
      switcher: {
        options: [personal, northbank],
        pendingInvitations: 0,
        invitationsHref: "/organisations/invitations",
        accountsHref: "/organisations",
        registerHref: "/onboarding/organisation?fresh=1",
      },
    };
    const openMenu = () => {
      render(<ShellUserMenu {...clientMenu} account={account} />);
      const trigger = screen.getByRole("button", {
        name: "Your accounts, acting as Northbank Gallery",
      });
      fireEvent.click(trigger);
      return trigger;
    };

    it("shows the account in use on the button and turns its chevron when open", () => {
      render(<ShellUserMenu {...clientMenu} account={account} />);
      const trigger = screen.getByRole("button", {
        name: "Your accounts, acting as Northbank Gallery",
      });
      expect(trigger).toHaveTextContent("NG");
      expect(trigger).toHaveTextContent("JS");
      const chevron = () => trigger.querySelector("svg:last-of-type");
      expect(chevron()).not.toHaveClass("rotate-180");
      fireEvent.click(trigger);
      expect(chevron()).toHaveClass("rotate-180");
    });

    it("lists the accounts inside the menu, as a group named Switch account of menu items", () => {
      openMenu();
      const menu = screen.getByRole("menu", { name: "Account" });
      const group = within(menu).getByRole("group", { name: "Switch account" });
      const rows = within(group).getAllByRole("menuitem");
      expect(rows).toHaveLength(2);
      for (const row of rows) expect(row).toHaveAttribute("data-account-menu-item");
      expect(within(group).getByRole("menuitem", { name: /Northbank Gallery/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    it("opens on the account in use with the down arrow, then moves through the accounts and on", async () => {
      render(<ShellUserMenu {...clientMenu} account={account} />);
      const trigger = screen.getByRole("button", {
        name: "Your accounts, acting as Northbank Gallery",
      });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      const current = await screen.findByRole("menuitem", { name: /Northbank Gallery/ });
      await waitFor(() => expect(current).toHaveFocus());

      fireEvent.keyDown(current, { key: "ArrowUp" });
      expect(screen.getByRole("menuitem", { name: /Personal/ })).toHaveFocus();

      const items = within(screen.getByRole("menu", { name: "Account" })).getAllByRole("menuitem");
      fireEvent.keyDown(screen.getByRole("menuitem", { name: /Personal/ }), { key: "ArrowDown" });
      fireEvent.keyDown(current, { key: "ArrowDown" });
      // Past the accounts, the arrow keys carry on through the rest of the menu.
      expect(items.indexOf(document.activeElement as HTMLElement)).toBe(2);
      expect(items.at(-1)).toHaveTextContent("Sign out");
    });
  });

  it("shows the role pill in sentence case at 12px", () => {
    render(<ShellUserMenu {...clientMenu} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const pill = screen.getByText("Client");
    expect(pill).toHaveClass("text-xs");
    expect(pill.className).not.toMatch(/uppercase|text-\[10px\]/);
  });
});
