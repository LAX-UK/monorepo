import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MarketingPhoneMenu } from "./marketing-phone-menu.js";

const FAMILY = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "shop", label: "lax.shop", href: "https://shop.lax.art", current: true },
];
const SECTIONS = [
  { id: "shop", label: "Shop", items: [{ label: "Prints", href: "/prints" }] },
  { id: "about", label: "About", items: [], linkHref: "/about" },
];

function Harness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Menu
      </button>
      <MarketingPhoneMenu
        open={open}
        onOpenChange={setOpen}
        resetKey="/"
        lockup={<span>Lockup</span>}
        familyLinks={FAMILY}
        sections={SECTIONS}
        isSectionActive={() => false}
        helpLinks={[
          { label: "Help", href: "/help" },
          { label: "Contact", href: "/contact" },
        ]}
        themeSlot={<button type="button">Theme</button>}
      />
    </>
  );
}

describe("MarketingPhoneMenu", () => {
  it("orders: lockup and Close, family row, main nav, help links, Theme last", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    const order = [
      within(dialog).getByTestId("phone-menu-header"),
      within(dialog).getByTestId("lax-family-menu-links"),
      within(dialog).getByRole("navigation", { name: "Main" }),
      within(dialog).getByRole("navigation", { name: "Help" }),
      within(dialog).getByTestId("phone-menu-theme"),
    ];
    for (let i = 0; i < order.length - 1; i++) {
      const position = order[i]?.compareDocumentPosition(order[i + 1] as Node) ?? 0;
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const header = within(dialog).getByTestId("phone-menu-header");
    expect(within(header).getByText("Lockup")).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    const last = dialog.querySelector('[data-testid="phone-menu-theme"]');
    expect(last?.nextElementSibling).toBeNull();
    expect(within(last as HTMLElement).getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });

  it("has no search and no account block", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("searchbox")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /search/i })).toBeNull();
    expect(within(dialog).queryByText(/sign in|create account/i)).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /account/i })).toBeNull();
  });

  it("expands a section and lists its links", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Shop" }));
    expect(screen.getByRole("link", { name: "Prints" })).toHaveAttribute("href", "/prints");
  });

  it("traps focus inside the drawer (the page behind is inert to the tab order)", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    // Radix focus-scope focuses into the content on open and marks everything else aria-hidden.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(
      screen.getByRole("button", { name: "Menu", hidden: true }).closest("[aria-hidden='true']"),
    ).not.toBeNull();
  });

  it("closes with Close and returns focus to the menu button", async () => {
    render(<Harness initiallyOpen={false} />);
    const opener = screen.getByRole("button", { name: "Menu" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("is an open modal, which hides the bottom bar", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-state", "open");
  });
});
