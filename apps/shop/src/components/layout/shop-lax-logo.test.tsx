/** @vitest-environment jsdom */
import { SHOP_LOGO_PATH, ShopLaxLogo } from "@/components/layout/shop-lax-logo";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ShopLaxLogo", () => {
  it("renders the Shop mark, not a Bid lockup", () => {
    const { container } = render(<ShopLaxLogo />);
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toBe(SHOP_LOGO_PATH);
    expect(images.some((img) => img.getAttribute("src") === "/logo.svg")).toBe(false);
    expect(images.some((img) => (img.getAttribute("src") ?? "").includes("logo-text"))).toBe(false);
  });
});
