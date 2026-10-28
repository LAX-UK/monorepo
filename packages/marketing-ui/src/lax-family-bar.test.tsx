import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LaxFamilyBar } from "./lax-family-bar.js";
import { LaxFamilyMenuLinks } from "./lax-family-menu-links.js";

const LINKS = [
  { id: "bid", label: "LAX Bid", href: "https://lax.bid", current: false },
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "shop", label: "LAX Shop", href: "https://shop.lax.art", current: true },
  { id: "account", label: "LAX Account", href: "https://account.lax.bid/account", current: false },
];

describe("LaxFamilyBar", () => {
  it("links the products in order, then LAX Account, each to its own URL", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "LAX products" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "LAX Bid",
      "lax.art",
      "LAX Shop",
      "LAX Account",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(LINKS.map((link) => link.href));
  });

  it("marks the current product for assistive technology and visually", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const current = screen.getByRole("link", { name: "LAX Shop" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current.className).toContain("font-semibold");
    expect(current.className).toContain("text-on-surface");

    const sibling = screen.getByRole("link", { name: "LAX Bid" });
    expect(sibling).not.toHaveAttribute("aria-current");
    expect(sibling.className).toContain("text-on-surface-variant");
    expect(sibling.className).not.toContain("font-semibold");
  });

  it("separates the products with dots that screen readers skip, and LAX Account with a divider", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "LAX products" });
    const dots = Array.from(nav.querySelectorAll("[aria-hidden]"));
    expect(dots.map((dot) => dot.textContent)).toEqual(["·", "·"]);
    const accountItem = screen.getByRole("link", { name: "LAX Account" }).closest("li");
    expect(accountItem?.className).toContain("border-l");
  });

  it("is hidden on phones, where the product menus carry the same links", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const bar = screen.getByTestId("lax-family-bar");
    expect(bar.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(bar.className).toContain("lg:flex");
  });

  it("keeps each name 12px or larger with a visible focus ring", () => {
    render(<LaxFamilyBar links={LINKS} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("text-xs");
      expect(link.className).toContain("focus-visible:outline-ring");
      expect(link.className).not.toContain("uppercase");
    }
  });

  it("shows the optional message and actions on the right, outside the products landmark", () => {
    render(
      <LaxFamilyBar
        links={LINKS}
        message="Free collection from our Marylebone gallery · Insured UK delivery £15"
        actions={<a href="/login">Log in</a>}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "LAX products" });
    const message = screen.getByText(/Free collection from our Marylebone gallery/);
    expect(nav).not.toContainElement(message);
    expect(nav).not.toContainElement(screen.getByRole("link", { name: "Log in" }));
  });

  it("uses the light-on-photograph colours over a hero", () => {
    render(<LaxFamilyBar links={LINKS} tone="on-dark" />);
    expect(screen.getByRole("link", { name: "LAX Shop" }).className).toContain(
      "text-hero-foreground",
    );
  });

  it("renders nothing when no product is configured", () => {
    const { container } = render(<LaxFamilyBar links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LaxFamilyMenuLinks", () => {
  it("lists the other products and LAX Account in the bar's order, leaving out the current one", () => {
    render(<LaxFamilyMenuLinks links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "LAX products" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["LAX Bid", "lax.art", "LAX Account"]);
  });

  it("gives each row a 44px target and closes the menu when one is chosen", () => {
    let closed = 0;
    render(<LaxFamilyMenuLinks links={LINKS} onNavigate={() => closed++} />);
    const link = screen.getByRole("link", { name: "lax.art" });
    expect(link.className).toContain("min-h-11");
    link.addEventListener("click", (event) => event.preventDefault());
    link.click();
    expect(closed).toBe(1);
  });

  it("renders nothing when the current product is the only one configured", () => {
    const { container } = render(<LaxFamilyMenuLinks links={[LINKS[2] as (typeof LINKS)[2]]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
