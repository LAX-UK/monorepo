import { buildAccountProducts } from "@/server/domain/account-products.vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCards } from "./product-cards";

describe("ProductCards", () => {
  it("renders a light and dark lockup and an Open link per product", () => {
    const html = renderToStaticMarkup(
      <ProductCards
        products={buildAccountProducts({
          bidPublicUrl: "https://lax.bid",
          shopPublicUrl: "https://shop.lax.bid",
          laxArtPublicUrl: "https://lax.art",
        })}
      />,
    );
    expect(html).toContain("Your LAX products");
    for (const name of ["LAX Bid", "LAX Shop", "LAX Art"]) {
      expect(html).toContain(`alt="${name}"`);
      expect(html).toContain(`aria-label="Open ${name}"`);
    }
    expect(html.match(/<img /g)).toHaveLength(6);
    expect(html).toContain('href="https://shop.lax.bid"');
  });

  it("renders nothing when no product is configured", () => {
    expect(renderToStaticMarkup(<ProductCards products={[]} />)).toBe("");
  });
});
