import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogPagination } from "./catalog-pagination";

describe("CatalogPagination", () => {
  it("shows range summary on mobile", () => {
    render(
      <CatalogPagination
        offset={0}
        limit={50}
        countOnPage={25}
        total={120}
        prevHref={null}
        nextHref="/admin/lots?offset=50"
      />,
    );
    expect(screen.getAllByText("Showing 1–25 of 120").length).toBeGreaterThan(0);
  });
});
