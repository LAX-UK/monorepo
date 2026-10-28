import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCardRow } from "./marketing-card-row.js";

function renderRow(labels: string[], max?: number) {
  return render(
    <MarketingCardRow
      aria-label="Cards"
      items={labels}
      {...(max === undefined ? {} : { max })}
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

  it("keeps every card in the open grid without a max", () => {
    renderRow(["1", "2", "3", "4", "5"]);
    const list = screen.getByRole("list", { name: "Cards" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(list.className).toContain("lg:grid-cols-3");
  });

  it("caps the row at one row of four and never starts a partial row", () => {
    renderRow(["1", "2", "3", "4", "5", "6"], 8);
    const list = screen.getByRole("list", { name: "Cards" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(list.className).toContain("lg:grid-cols-4");
    expect(screen.queryByText("5")).toBeNull();
  });

  it("lays three capped cards as a row of three", () => {
    renderRow(["1", "2", "3"], 4);
    expect(screen.getByRole("list", { name: "Cards" }).className).toContain("lg:grid-cols-3");
  });

  it("keeps the pair form under a small cap", () => {
    renderRow(["1", "2", "3"], 2);
    expect(screen.getByRole("list", { name: "Cards" })).toHaveAttribute("data-layout", "pair");
  });
});
