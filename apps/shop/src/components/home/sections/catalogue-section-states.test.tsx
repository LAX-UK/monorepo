/** @vitest-environment jsdom */
import { homeSections } from "@/content/home-marketing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
import { CategoriesSection } from "./categories-section";
import { OriginalsSection } from "./originals-section";
import { PrintsSection } from "./prints-section";

describe("catalogue section states", () => {
  it("distinguishes an upstream failure from an honestly empty collection", () => {
    const { rerender } = render(
      <OriginalsSection
        section={homeSections.originals}
        cards={[]}
        errorMessage="upstream unavailable"
      />,
    );
    expect(screen.getByTestId("marketing-status-motif-alert")).toBeTruthy();
    expect(screen.getByText("Originals are temporarily unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse artworks" }).getAttribute("href")).toBe(
      "/artworks",
    );

    rerender(<CategoriesSection section={homeSections.categories} cards={[]} />);
    expect(screen.getByTestId("marketing-status-motif-gallery")).toBeTruthy();
    expect(screen.getByText("No categories to show yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("link", { name: "Browse categories" }).getAttribute("href")).toBe(
      "/categories",
    );
  });

  it("offers retry and browse actions for print failures", () => {
    render(
      <PrintsSection
        section={homeSections.prints}
        cards={[]}
        errorMessage="upstream unavailable"
      />,
    );
    expect(screen.getByTestId("marketing-status-motif-alert")).toBeTruthy();
    expect(screen.getByText("Prints are temporarily unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse artworks" })).toBeTruthy();
  });
});
