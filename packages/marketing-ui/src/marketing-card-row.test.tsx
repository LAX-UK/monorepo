import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCardRow } from "./marketing-card-row.js";

function renderRow(labels: string[]) {
  return render(
    <MarketingCardRow
      aria-label="Cards"
      items={labels}
      getKey={(label) => label}
      renderItem={(label, layout) => <p data-layout={layout}>{label}</p>}
    />,
  );
}

describe("MarketingCardRow", () => {
  it("shows one card as a wide feature", () => {
    renderRow(["One"]);
    expect(screen.getByRole("list", { name: "Cards" })).toHaveAttribute("data-layout", "feature");
    expect(screen.getByText("One")).toHaveAttribute("data-layout", "feature");
  });

  it("shows two cards side by side", () => {
    renderRow(["One", "Two"]);
    const list = screen.getByRole("list", { name: "Cards" });
    expect(list).toHaveAttribute("data-layout", "pair");
    expect(list.className).toContain("sm:grid-cols-2");
    expect(list.className).not.toContain("lg:grid-cols-3");
  });

  it("fills the grid from three cards", () => {
    renderRow(["One", "Two", "Three"]);
    const list = screen.getByRole("list", { name: "Cards" });
    expect(list.className).toContain("lg:grid-cols-3");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders nothing without cards", () => {
    const { container } = renderRow([]);
    expect(container).toBeEmptyDOMElement();
  });
});
