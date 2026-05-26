import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardEmptyState", () => {
  it("wires aria-labelledby to the heading for quiet variant", () => {
    const { container } = render(
      <DashboardEmptyState title="No bids yet" description="Place a bid to see activity here." />,
    );

    const region = container.querySelector("section[aria-labelledby]");
    expect(region).toBeTruthy();
    const labelledBy = region?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const heading = container.querySelector(`#${CSS.escape(labelledBy ?? "")}`);
    expect(heading?.tagName).toBe("H2");
    expect(heading).toHaveTextContent("No bids yet");
  });

  it("defaults headingLevel to h2 and allows h3", () => {
    const { container, rerender } = render(
      <DashboardEmptyState variant="hero" title="All caught up" />,
    );

    expect(container.querySelector("h2")).toHaveTextContent("All caught up");

    rerender(<DashboardEmptyState variant="hero" title="All caught up" headingLevel="h3" />);
    expect(container.querySelector("h3")).toHaveTextContent("All caught up");
    expect(container.querySelector("h2")).toBeNull();
  });

  it("wires aria-labelledby on hero variant section", () => {
    const { container } = render(<DashboardEmptyState variant="hero" title="All caught up" />);
    expect(container.querySelector("section[aria-labelledby]")).toBeTruthy();
  });
});
