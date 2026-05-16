import { CatalogByView } from "@/components/marketing/catalog-by-view";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("CatalogByView", () => {
  it("renders emptyMessage when items are empty and emptyMessage is provided", () => {
    render(
      <CatalogByView
        view="grid"
        items={[]}
        emptyMessage="Nothing here."
        renderGrid={() => <div data-testid="grid">grid</div>}
        renderList={() => <div data-testid="list">list</div>}
      />,
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
  });

  it("delegates to renderGrid when empty and emptyMessage is undefined", () => {
    render(
      <CatalogByView
        view="grid"
        items={[]}
        renderGrid={() => <div data-testid="grid">grid</div>}
        renderList={() => <div data-testid="list">list</div>}
      />,
    );
    expect(screen.getByTestId("grid")).toHaveTextContent("grid");
  });

  it("uses renderList for list view", () => {
    render(
      <CatalogByView
        view="list"
        items={["a"]}
        renderGrid={() => <div data-testid="grid">grid</div>}
        renderList={(items) => <div data-testid="list">{items.join(",")}</div>}
      />,
    );
    expect(screen.getByTestId("list")).toHaveTextContent("a");
    expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
  });

  it("uses renderCard for card view when renderCard is provided", () => {
    render(
      <CatalogByView
        view="card"
        items={["x"]}
        renderGrid={() => <div data-testid="grid">grid</div>}
        renderList={() => <div data-testid="list">list</div>}
        renderCard={(items) => <div data-testid="card">{items.join(",")}</div>}
      />,
    );
    expect(screen.getByTestId("card")).toHaveTextContent("x");
  });

  it("falls back to renderGrid for card view when renderCard is omitted", () => {
    render(
      <CatalogByView
        view="card"
        items={["y"]}
        renderGrid={(items) => <div data-testid="grid">{items.join(",")}</div>}
        renderList={() => <div data-testid="list">list</div>}
      />,
    );
    expect(screen.getByTestId("grid")).toHaveTextContent("y");
  });
});
