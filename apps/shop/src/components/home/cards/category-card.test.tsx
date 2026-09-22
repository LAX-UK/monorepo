/** @vitest-environment jsdom */
import { CategoryCard } from "@/components/home/cards/category-card";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("CategoryCard", () => {
  it("renders the title below the image and keeps the category destination", () => {
    const { container } = render(
      <CategoryCard
        card={{
          id: "category-art",
          image: "/shop/home/category-watches.webp",
          imageAlt: "Art",
          label: "Art",
          href: "/categories/art",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "Art" });
    expect(link.getAttribute("href")).toBe("/categories/art");
    expect(link.querySelector(".shop-home__category-copy")).toBeTruthy();
    expect(container.querySelector(".shop-home__category-image")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Art" })).toBeTruthy();
  });
});
