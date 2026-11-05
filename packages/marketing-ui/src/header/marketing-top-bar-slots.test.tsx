import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingTopBarSlots } from "./marketing-top-bar-slots.js";

function slots(withAction = true) {
  return (
    <MarketingTopBarSlots
      searchField={<input aria-label="Search" />}
      searchIcon={<button type="button">Search icon</button>}
      {...(withAction ? { productAction: <a href="/basket">Basket</a> } : {})}
      account={<button type="button">Account</button>}
      menuButton={<button type="button">Menu</button>}
    />
  );
}

function slot(name: string) {
  return screen.getByTestId("top-bar-slots").querySelector(`[data-slot="${name}"]`);
}

describe("MarketingTopBarSlots", () => {
  it("below 768px shows only the menu button", () => {
    render(slots());
    expect(slot("menu")?.className).not.toContain("hidden");
    for (const name of ["search-field", "search-icon", "product-action", "account"]) {
      expect(slot(name)?.className).toContain("hidden");
    }
  });

  it("from 768px orders search, product action, account, then menu", () => {
    render(slots());
    const names = [...screen.getByTestId("top-bar-slots").children].map((el) =>
      el.getAttribute("data-slot"),
    );
    expect(names).toEqual(["search-field", "search-icon", "product-action", "account", "menu"]);
    expect(slot("account")?.className).toContain("md:block");
    expect(slot("product-action")?.className).toContain("md:block");
  });

  it("uses an underlined 240px field from 1280px and an icon below that", () => {
    render(slots());
    expect(slot("search-field")?.className).toContain("w-60");
    expect(slot("search-field")?.className).toContain("xl:block");
    expect(slot("search-icon")?.className).toContain("md:block");
    expect(slot("search-icon")?.className).toContain("xl:hidden");
  });

  it("omits the product action slot when the product has none", () => {
    render(slots(false));
    expect(slot("product-action")).toBeNull();
  });
});
