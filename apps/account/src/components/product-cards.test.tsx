import { buildAccountProducts } from "@/server/domain/account-products.vm";
import { item } from "@/server/domain/portfolio-fixtures.test-util";
import { buildProductSummaries } from "@/server/domain/product-summary.vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCards } from "./product-cards";

const PRODUCTS = buildAccountProducts({
  bidPublicUrl: "https://lax.bid",
  shopPublicUrl: "https://shop.lax.bid",
  laxArtPublicUrl: "https://lax.art",
});

const shopEdition = (id: string, status: "owned" | "awaiting_shipment" = "owned") =>
  item({ product: "shop", id, status });

describe("ProductCards", () => {
  it("shows the person's own counts, and the invitation for a product they hold nothing in", () => {
    const text = renderToStaticMarkup(
      <ProductCards
        products={PRODUCTS}
        summaries={buildProductSummaries([shopEdition("a"), shopEdition("b", "awaiting_shipment")])}
      />,
    );
    expect(text).toContain("2 editions · 1 on its way");
    expect(text).toContain("Discover original art.");
    expect(text).toContain("Find your next lot.");
    expect(text).not.toContain("Browse signed and limited editions.");
  });

  it("shows a grey line in place of the count while loading", () => {
    const html = renderToStaticMarkup(<ProductCards products={PRODUCTS} summaries={null} />);
    expect(html.match(/animate-pulse/g)).toHaveLength(3);
    expect(html).toContain('alt="LAX Shop"');
    expect(html).not.toContain("Discover original art.");
  });

  it("says a product failed to load with a way to try again, while the others keep their counts", () => {
    const html = renderToStaticMarkup(
      <ProductCards
        products={PRODUCTS}
        summaries={buildProductSummaries([item({ product: "bid" })], ["shop", "art"])}
        retryHref="/account"
      />,
    );
    expect(html).toContain("We couldn&#x27;t load LAX Shop just now.");
    expect(html).toContain("We couldn&#x27;t load lax.art just now.");
    expect(html).not.toContain("We couldn&#x27;t load LAX Bid");
    expect(html).toContain("1 work");
    expect(html.match(/href="\/account"/g)).toHaveLength(2);
  });

  it("renders a light and dark lockup and an Open link per product", () => {
    const html = renderToStaticMarkup(
      <ProductCards products={PRODUCTS} summaries={buildProductSummaries([])} />,
    );
    expect(html).toContain("Your LAX products");
    for (const name of ["lax.art", "LAX Shop", "LAX Bid"]) {
      expect(html).toContain(`alt="${name}"`);
      expect(html).toContain(`aria-label="Open ${name}"`);
    }
    expect(html.match(/<img /g)).toHaveLength(6);
    expect(html).toContain('href="https://shop.lax.bid"');
  });

  it("renders nothing when no product is configured", () => {
    expect(renderToStaticMarkup(<ProductCards products={[]} summaries={null} />)).toBe("");
  });
});
