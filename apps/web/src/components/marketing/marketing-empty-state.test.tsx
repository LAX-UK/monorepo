/** @vitest-environment jsdom */
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("MarketingEmptyState", () => {
  it("maps filtered context to the shared search placard", () => {
    render(
      <MarketingEmptyState
        context="filtered"
        title="No lots match"
        description="Adjust filters."
      />,
    );

    expect(screen.getByTestId("marketing-status-motif-search")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves explicit alert semantics when role is provided", () => {
    render(
      <MarketingEmptyState
        context="error"
        role="alert"
        title="Something went wrong"
        description="Retry shortly."
      />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("honours explicit announcement over role alias", () => {
    render(
      <MarketingEmptyState
        context="noResults"
        announcement="polite"
        role="alert"
        title="No results"
      />,
    );

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
