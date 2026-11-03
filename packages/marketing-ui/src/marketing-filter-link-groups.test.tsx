import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFilterLinkGroups } from "./marketing-filter-link-groups.js";

describe("MarketingFilterLinkGroups", () => {
  it("titles each group with a level 2 heading so the outline never skips a level", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "medium",
            title: "Medium",
            links: [{ label: "Oil", href: "/?medium=oil", active: false }],
          },
          { id: "empty", title: "Empty group", links: [] },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Medium" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Empty group" })).not.toBeInTheDocument();
  });
});
