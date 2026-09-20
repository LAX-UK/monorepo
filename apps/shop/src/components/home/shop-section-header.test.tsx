/** @vitest-environment jsdom */
import { ShopSectionHeader } from "@/components/home/shop-section-header";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ShopSectionHeader", () => {
  it("links section actions with accessible headings", () => {
    render(
      <ShopSectionHeader
        headingId="prints-heading"
        title="Prints & Multiples"
        subtitle="Limited editions"
        actionLabel="Browse all works"
        actionHref="/collect"
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Prints & Multiples" }).getAttribute("id"),
    ).toBe("prints-heading");
    expect(screen.getByText("Limited editions")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse all works" }).getAttribute("href")).toBe(
      "/collect",
    );
  });
});
