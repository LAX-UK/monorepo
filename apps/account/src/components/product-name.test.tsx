import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductName, ProductText, productOfName } from "./product-name";

describe("ProductName", () => {
  it("sets a product's name in that product's colour token", () => {
    const html = renderToStaticMarkup(<ProductName product="bid">LAX Bid</ProductName>);
    expect(html).toContain('data-product="bid"');
    expect(html).toContain("text-product-bid");
    expect(html).toContain("font-medium");
  });

  it("keeps a heading's weight when asked to", () => {
    const html = renderToStaticMarkup(
      <ProductName product="art" weight="inherit">
        lax.art
      </ProductName>,
    );
    expect(html).not.toContain("font-medium");
  });
});

describe("ProductText", () => {
  it("colours every full product name in a sentence and leaves the rest as text", () => {
    const html = renderToStaticMarkup(
      <ProductText text="Shared with LAX Bid, LAX Shop and lax.art." />,
    );
    expect(html).toBe(
      'Shared with <span data-product="bid" class="text-product-bid font-medium">LAX Bid</span>, ' +
        '<span data-product="shop" class="text-product-shop font-medium">LAX Shop</span> and ' +
        '<span data-product="art" class="text-product-art font-medium">lax.art</span>.',
    );
  });

  it("leaves bare words alone, because 'Bid' is also a verb", () => {
    expect(renderToStaticMarkup(<ProductText text="Bid on auctions" />)).toBe("Bid on auctions");
  });

  it("knows which product a full name belongs to", () => {
    expect(productOfName("LAX Account")).toBe("account");
    expect(productOfName("lax.art")).toBe("art");
    expect(productOfName("Bid")).toBeNull();
  });
});
