import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminShell, type AdminShellNavGroup } from "./admin-shell.js";

const GROUPS: AdminShellNavGroup[] = [
  { title: "Overview", items: [{ href: "/overview", label: "Overview" }] },
  {
    title: "Shop",
    items: [
      { href: "/orders", label: "Orders", attentionCount: 3 },
      { href: "/holds", label: "Stock holds" },
    ],
  },
];

function renderShell(pathname: string) {
  return render(
    <AdminShell
      productName="LAX Admin"
      navGroups={GROUPS}
      pathname={pathname}
      account={<button type="button">Sign out</button>}
      header={<span>Crumbs</span>}
    >
      <h1>Page</h1>
    </AdminShell>,
  );
}

describe("AdminShell", () => {
  it("marks the owning nav item as the current page", () => {
    renderShell("/orders/123");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: /Orders/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Stock holds" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders groups, the attention count, the account slot and the header slot", () => {
    renderShell("/overview");
    expect(screen.getByText("Shop")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByText("Crumbs")).toBeInTheDocument();
  });

  it("has one main landmark and a skip link that targets it", () => {
    renderShell("/overview");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });

  it("opens the navigation drawer from the menu button and returns focus on close", async () => {
    renderShell("/overview");
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Stock holds" })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the drawer after choosing a page", async () => {
    renderShell("/overview");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = await screen.findByRole("dialog");
    const link = within(dialog).getByRole("link", { name: "Stock holds" });
    expect(link).toHaveAttribute("href", "/holds");
    // The shell's default link is a plain anchor and jsdom cannot navigate: stop the click after
    // React has handled it, so the test asserts on the drawer and not on a page load.
    const stopNavigation = (event: Event) => event.preventDefault();
    document.addEventListener("click", stopNavigation);
    try {
      fireEvent.click(link);
    } finally {
      document.removeEventListener("click", stopNavigation);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
