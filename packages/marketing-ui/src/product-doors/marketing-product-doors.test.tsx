import { PRODUCT_ACCENTS, PRODUCT_ACCENTS_ON_DARK } from "@auction/branding";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarketingProductDoorVm } from "./marketing-product-door.js";
import { MarketingProductDoors } from "./marketing-product-doors.js";
import { PRODUCT_DOOR_BRANDS } from "./product-door-brands.js";

const shop: MarketingProductDoorVm = {
  product: "shop",
  title: "Limited editions from our artists",
  promise: "Editions and prints, bought online and delivered.",
  actionLabel: "Visit LAX Shop",
  href: "https://shop.test/",
};
const bid: MarketingProductDoorVm = {
  product: "bid",
  title: "Auctions you can join from anywhere",
  promise: "Bid in live and timed sales.",
  actionLabel: "Visit LAX Bid",
  href: "https://bid.test/",
};

function renderDoors(doors: readonly MarketingProductDoorVm[], description?: string) {
  return render(
    <MarketingProductDoors
      title="Across LAX"
      doors={doors}
      {...(description ? { description } : {})}
    />,
  );
}

describe("MarketingProductDoors", () => {
  it("is a section named by its title, with the doors in the host's order", () => {
    renderDoors([shop, bid], "Two more ways to collect.");

    const section = screen.getByRole("region", { name: "Across LAX" });
    expect(within(section).getByText("Two more ways to collect.")).toBeInTheDocument();
    const links = within(section).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://shop.test/",
      "https://bid.test/",
    ]);
  });

  it("makes the whole door one link named by product and title, described by promise and action", () => {
    renderDoors([bid]);

    const link = screen.getByRole("link", { name: "lax.bid: Auctions you can join from anywhere" });
    expect(link).toHaveAccessibleDescription("Bid in live and timed sales. Visit LAX Bid");
    expect(within(link).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Auctions you can join from anywhere",
    );
  });

  it("shows the product's lockup and sets its accent for light and dark surfaces", () => {
    renderDoors([shop]);

    const link = screen.getByRole("link", { name: /^lax.shop:/ });
    expect(link.querySelector("svg.lax-lockup title")?.textContent).toBe("LAX Shop");
    expect(link.style.getPropertyValue("--door-accent")).toBe(PRODUCT_ACCENTS.shop);
    expect(link.style.getPropertyValue("--door-accent-dark")).toBe(PRODUCT_ACCENTS_ON_DARK.shop);
  });

  it("leaves lax.art's lockup on the text colour, since it has no accent", () => {
    renderDoors([
      { ...shop, product: "art", imageUrl: "/art/door.webp", actionLabel: "Visit lax.art" },
    ]);

    const link = screen.getByRole("link", { name: /^lax\.art:/ });
    expect(link.style.getPropertyValue("--door-accent")).toBe("");
  });

  it("uses the product's own illustration, or the host's image when it overrides it", () => {
    const { container, rerender } = renderDoors([bid]);
    const illustration = PRODUCT_DOOR_BRANDS.bid.illustration?.src ?? "";
    expect(illustration).toMatch(/bid\.webp/);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("bid.webp");

    rerender(
      <MarketingProductDoors
        title="Across LAX"
        doors={[{ ...bid, imageUrl: "https://cdn.test/promo.jpg" }]}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      encodeURIComponent("https://cdn.test/promo.jpg"),
    );
  });

  it("keeps the external cue decorative", () => {
    renderDoors([shop]);

    const link = screen.getByRole("link", { name: /^lax.shop:/ });
    for (const svg of link.querySelectorAll("svg:not(.lax-lockup)")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("centres a lone door and renders nothing without doors", () => {
    const { container } = renderDoors([shop]);
    expect(container.querySelector("ul")?.className).toContain("md:w-2/3");

    const empty = renderDoors([]);
    expect(empty.container).toBeEmptyDOMElement();
  });
});
