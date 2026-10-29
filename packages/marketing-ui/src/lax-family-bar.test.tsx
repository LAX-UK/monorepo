import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LaxFamilyBar } from "./lax-family-bar.js";
import { LaxFamilyMenuLinks } from "./lax-family-menu-links.js";

const LINKS = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "shop", label: "lax.shop", href: "https://shop.lax.art", current: true },
  { id: "bid", label: "lax.bid", href: "https://lax.bid", current: false },
  { id: "account", label: "LAX Account", href: "https://account.lax.bid/account", current: false },
];

describe("LaxFamilyBar", () => {
  it("links the products in order, then LAX Account, each to its own URL", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "LAX family" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "lax.art",
      "lax.shop",
      "lax.bid",
      "LAX Account",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(LINKS.map((link) => link.href));
  });

  it("marks the current product for assistive technology and visually", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const current = screen.getByRole("link", { name: "lax.shop" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current.className).toContain("font-semibold");
    expect(current.className).toContain("text-on-surface");

    const sibling = screen.getByRole("link", { name: "lax.bid" });
    expect(sibling).not.toHaveAttribute("aria-current");
    expect(sibling.className).toContain("text-on-surface-variant");
    expect(sibling.className).not.toContain("font-semibold");
  });

  it("spaces the products evenly with no separators, and sets LAX Account after a divider", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "LAX family" });
    expect(nav.querySelectorAll("[aria-hidden]")).toHaveLength(0);
    expect(nav.textContent).not.toContain("·");
    const accountItem = screen.getByRole("link", { name: "LAX Account" }).closest("li");
    expect(accountItem?.className).toContain("border-l");
  });

  it("underlines the current product in its accent without moving the layout", () => {
    render(<LaxFamilyBar links={LINKS} />);
    const current = screen.getByRole("link", { name: "lax.shop" });
    expect(current.className).toContain("before:bg-[var(--family-accent,currentColor)]");
    expect(current.style.getPropertyValue("--family-accent")).toBe("#5a2a5c");
    expect(current.style.getPropertyValue("--family-accent-on-dark")).toBe("#d6a8d4");
    expect(current.className).toContain("before:absolute");
    expect(current.className).not.toMatch(/(^|\s)(underline|hover:underline)(\s|$)/);

    const sibling = screen.getByRole("link", { name: "lax.bid" });
    expect(sibling.className).toContain("before:bg-transparent");
    expect(sibling.className).toContain("hover:before:bg-current");
    expect(sibling.className).toContain("hover:before:h-px");
    expect(sibling.className).not.toContain("font-semibold");
    expect(current.className).toContain("before:h-0.5");
  });

  it("underlines lax.art in the text colour, since the umbrella product has no accent", () => {
    render(<LaxFamilyBar links={LINKS.map((l) => ({ ...l, current: l.id === "art" }))} />);
    const current = screen.getByRole("link", { name: "lax.art" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current.style.getPropertyValue("--family-accent")).toBe("");
  });

  it("keeps the current product a link home", () => {
    render(<LaxFamilyBar links={LINKS} />);
    expect(screen.getByRole("link", { name: "lax.shop" })).toHaveAttribute(
      "href",
      "https://shop.lax.art",
    );
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
    const nav = screen.getByRole("navigation", { name: "LAX family" });
    const message = screen.getByText(/Free collection from our Marylebone gallery/);
    expect(nav).not.toContainElement(message);
    expect(nav).not.toContainElement(screen.getByRole("link", { name: "Log in" }));
  });

  it("uses the light-on-photograph colours over a hero", () => {
    render(<LaxFamilyBar links={LINKS} tone="on-dark" />);
    const current = screen.getByRole("link", { name: "lax.shop" });
    expect(current.className).toContain("text-hero-foreground");
    expect(current.className).toContain("before:bg-current");
    expect(current.style.getPropertyValue("--family-accent")).toBe("");
  });

  it("renders nothing when no product is configured", () => {
    const { container } = render(<LaxFamilyBar links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LaxFamilyMenuLinks", () => {
  it("lists every product and LAX Account in the bar's order", () => {
    render(<LaxFamilyMenuLinks links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "LAX family menu" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(LINKS.map((link) => link.href));
  });

  it("says in words which product the person is on", () => {
    render(<LaxFamilyMenuLinks links={LINKS} />);
    const current = screen.getByRole("link", { name: /lax\.shop/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveTextContent("You're here");
    expect(screen.getAllByText("You're here")).toHaveLength(1);
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

  it("renders nothing when no product is configured", () => {
    const { container } = render(<LaxFamilyMenuLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
