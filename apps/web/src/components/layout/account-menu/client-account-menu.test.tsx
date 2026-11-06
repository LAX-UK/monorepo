import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { buildHeaderAccountMenu } from "@/lib/navigation/header-account-menu.vm";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactElement, type ReactNode, cloneElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ClientAccountMenu } from "./client-account-menu";

vi.mock("@/lib/auth/use-logout", () => ({
  useLogout: () => ({ logout: vi.fn(), pending: false }),
}));

const switchAccount = vi.fn();
vi.mock("@/lib/navigation/switch-account", () => ({
  switchAccount: (...args: unknown[]) => switchAccount(...args),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({ switchActingLegalEntity: vi.fn() }));
vi.mock("@/lib/legal-entity/account-switch-channel", () => ({ announceAccountSwitch: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn() } }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const MEMBER_MENU = buildHeaderAccountMenu({
  scope: { context: { kind: "personal" }, hasSubmissions: true },
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
  attention: { ...NO_ATTENTION, outbidLots: ["14"], paymentsDue: 1 },
  pathname: "/bids",
});

/** The dropdown makes each row a menu item; this stands in for it. */
function asMenuItem(row: ReactElement): ReactElement {
  return cloneElement(row, { role: "menuitem" } as object);
}

function renderMenu() {
  render(
    <div role="menu" aria-label="Account">
      <ClientAccountMenu
        menu={MEMBER_MENU}
        surface="popover"
        onNavigate={() => {}}
        wrapItem={asMenuItem}
      />
    </div>,
  );
  return screen.getByRole("menu", { name: "Account" });
}

describe("ClientAccountMenu", () => {
  it("lists the person's accounts under Switch account, the one in use marked Current", () => {
    const accounts = within(renderMenu()).getByRole("group", { name: "Switch account" });
    const current = within(accounts).getByRole("menuitem", {
      name: /Jordan Hale.*Personal.*current/,
    });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveTextContent("Current");
    expect(
      within(accounts).getByRole("menuitem", { name: /Northgate Collection Ltd.*Buyer/ }),
    ).toBeVisible();
  });

  it("switches through the switch action and a page load, never a link to the hop", async () => {
    const assign = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, "location", { value: { assign }, configurable: true });
    switchAccount.mockResolvedValue({ kind: "switched" });
    try {
      const accounts = within(renderMenu()).getByRole("group", { name: "Switch account" });
      const row = within(accounts).getByRole("menuitem", { name: /Northgate Collection Ltd/ });
      expect(row.tagName).toBe("BUTTON");
      expect(row).not.toHaveAttribute("href");
      fireEvent.click(row);
      await waitFor(() => expect(assign).toHaveBeenCalledWith("/home"));
      expect(switchAccount).toHaveBeenCalledWith("org-1", expect.any(Function));
    } finally {
      Object.defineProperty(window, "location", { value: realLocation, configurable: true });
    }
  });

  it("marks the page in view and reads out what is due", () => {
    const buying = within(renderMenu()).getByRole("group", { name: "Buying" });
    expect(within(buying).getByRole("menuitem", { name: /My bids.*1 outbid/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(buying).getByRole("menuitem", { name: /Purchases.*1 to pay/ })).toBeVisible();
  });

  it("ends with LAX Account (out of Bid) and Sign out", () => {
    const menu = renderMenu();
    expect(within(menu).getByRole("menuitem", { name: "LAX Account" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    const items = within(menu).getAllByRole("menuitem");
    expect(items.at(-1)).toHaveTextContent("Sign out");
  });
});
