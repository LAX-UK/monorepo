import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LayoutDashboard, Receipt, Users } from "lucide-react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

// Radix sheets, dialogs, tooltips and menus keep positioning and focus loops running in jsdom.
// These stand-ins keep the open/close contract so the shell's own behaviour is what is tested.
vi.mock("@auction/ui/components/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetClose: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: () => null,
    DropdownMenuItem: Pass,
    DropdownMenuCheckboxItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => null,
    DropdownMenuRadioGroup: Pass,
    DropdownMenuRadioItem: Pass,
  };
});
vi.mock("@auction/ui/components/command", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Command: Pass,
    CommandInput: (props: { "aria-label"?: string }) => <input aria-label={props["aria-label"]} />,
    CommandList: Pass,
    CommandEmpty: () => null,
    CommandGroup: Pass,
    CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => (
      <div
        // biome-ignore lint/a11y/useSemanticElements: stands in for cmdk's item, which is a div with role option
        role="option"
        aria-selected={false}
        tabIndex={-1}
        onClick={onSelect}
        onKeyDown={onSelect}
      >
        {children}
      </div>
    ),
  };
});

const { StaffShell } = await import("./staff-shell.js");
const { STAFF_NAV_COOKIE } = await import("./nav-cookie.js");
const { PlainLink } = await import("@auction/ui/lax");

const product = { id: "lax-admin" as const, name: "LAX Admin", description: "Shop", href: "/" };

function renderShell(pathname = "/orders/123", navigate = vi.fn()) {
  render(
    <StaffShell
      product={product}
      products={[product]}
      navGroups={[
        { id: "top", items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }] },
        {
          id: "shop",
          title: "Shop",
          items: [
            { href: "/orders", label: "Orders", icon: Receipt, count: 3, countTone: "attention" },
            { href: "/staff", label: "Staff", icon: Users },
          ],
        },
      ]}
      pathname={pathname}
      Link={PlainLink}
      navigate={navigate}
      account={<span>Account</span>}
    >
      <p>Page body</p>
    </StaffShell>,
  );
  return navigate;
}

describe("StaffShell", () => {
  it("has one main landmark, a skip link and the active page marked", () => {
    renderShell();
    expect(screen.getByRole("main")).toHaveTextContent("Page body");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0] as HTMLElement;
    expect(within(nav).getByRole("link", { name: /Orders/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: /Orders/ })).toHaveTextContent("3 waiting");
    expect(within(nav).getByRole("list", { name: "Shop" })).toBeInTheDocument();
  });

  it("collapses the nav and remembers it in a cookie", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Collapse navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(document.cookie).toContain(`${STAFF_NAV_COOKIE}=collapsed`);
  });

  it("opens search with ⌘K and Ctrl+K and goes to a page from it", async () => {
    const navigate = renderShell();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("textbox", { name: "Search pages and records" }),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("option", { name: /Staff/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/staff"));
    fireEvent.keyDown(window, { key: "K", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the nav drawer from the menu button on small screens", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByTestId("sheet")).toHaveTextContent("LAX Admin navigation");
  });
});
