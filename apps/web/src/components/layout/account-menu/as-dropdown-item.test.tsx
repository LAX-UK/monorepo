import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { buildHeaderAccountMenu } from "@/lib/navigation/header-account-menu.vm";
import { DropdownMenu, DropdownMenuContent } from "@auction/ui/components/dropdown-menu";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const switchAccount = vi.fn();
vi.mock("@/lib/auth/use-logout", () => ({
  useLogout: () => ({ logout: vi.fn(), pending: false }),
}));
vi.mock("@/lib/navigation/switch-account", () => ({
  switchAccount: (...args: unknown[]) => switchAccount(...args),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({ switchActingLegalEntity: vi.fn() }));
vi.mock("@/lib/legal-entity/account-switch-channel", () => ({ announceAccountSwitch: vi.fn() }));
vi.mock("@/lib/navigation/account-notice-cookie.client", () => ({ leaveAccountNotice: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { asDropdownItem } from "./as-dropdown-item";
import { ClientAccountMenu } from "./client-account-menu";

const menu = buildHeaderAccountMenu({
  scope: { context: { kind: "personal" }, hasSubmissions: false },
  accounts: [
    {
      id: "me",
      kind: "personal",
      name: "Personal",
      detail: "Jordan Hale",
      initials: "JH",
      current: true,
      underReview: false,
    },
    {
      id: "org-1",
      kind: "organisation",
      name: "Northgate Collection Ltd",
      detail: "Buyer",
      initials: "NC",
      current: false,
      underReview: false,
    },
  ],
  pendingInvitations: 0,
  attention: NO_ATTENTION,
  pathname: "/bids",
});

function renderOpenMenu(onOpenChange = vi.fn()) {
  render(
    <DropdownMenu open onOpenChange={onOpenChange}>
      <DropdownMenuContent>
        <ClientAccountMenu
          menu={menu}
          surface="popover"
          onNavigate={() => {}}
          wrapItem={asDropdownItem}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return onOpenChange;
}

describe("the avatar menu's account rows", () => {
  it("keep the menu open while the switch runs, so Switching… stays in view", async () => {
    switchAccount.mockReturnValue(new Promise(() => {}));
    const onOpenChange = renderOpenMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Northgate Collection Ltd/ }));
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("menuitem", { name: /Northgate Collection Ltd/ })).toHaveTextContent(
      "Switching…",
    );
  });

  it("keep the menu open on a failure and show it with Try again", async () => {
    switchAccount.mockResolvedValue({
      kind: "refused",
      title: "Could not switch",
      description: "Please try again in a moment.",
    });
    const onOpenChange = renderOpenMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Northgate Collection Ltd/ }));
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not switch.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
