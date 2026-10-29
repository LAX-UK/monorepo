import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFilterTrigger } from "./marketing-filter-trigger.js";

describe("MarketingFilterTrigger", () => {
  it("reads Filters by default", () => {
    render(<MarketingFilterTrigger />);
    expect(screen.getByRole("button")).toHaveTextContent("Filters");
  });

  it("takes its own label and shows the active count", () => {
    render(<MarketingFilterTrigger label="Filter and sort" activeCount={2} />);
    expect(screen.getByRole("button")).toHaveTextContent("Filter and sort");
    expect(screen.getByLabelText("2 active filters")).toBeInTheDocument();
  });
});
