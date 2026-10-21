import { Accordion } from "@auction/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MarketingFilterAccordionSection,
  MarketingFilterFacetGroup,
} from "./marketing-filter-facet-group.js";

const ARTISTS = [
  { value: "ada", label: "Ada Lane" },
  { value: "bo", label: "Bo Reed" },
];

describe("MarketingFilterFacetGroup", () => {
  it("toggles checkbox values in a named group under an accordion heading", () => {
    const onChange = vi.fn();
    render(
      <Accordion type="multiple" defaultValue={["artist"]}>
        <MarketingFilterFacetGroup
          value="artist"
          title="Artist"
          idPrefix="drawer-artist"
          options={ARTISTS}
          selected={["ada"]}
          onChange={onChange}
        />
      </Accordion>,
    );
    expect(screen.getByRole("button", { name: "Artist" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Artist" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Bo Reed" }));
    expect(onChange).toHaveBeenLastCalledWith(["ada", "bo"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ada Lane" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("replaces the value in single selection", () => {
    const onChange = vi.fn();
    render(
      <Accordion type="multiple" defaultValue={["sort"]}>
        <MarketingFilterFacetGroup
          value="sort"
          title="Sort by"
          idPrefix="drawer-sort"
          selection="single"
          options={[
            { value: "newest", label: "Newest" },
            { value: "titleAsc", label: "Title (A–Z)" },
          ]}
          selected={["newest"]}
          onChange={onChange}
        />
      </Accordion>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Title (A–Z)" }));
    expect(onChange).toHaveBeenCalledWith(["titleAsc"]);
  });

  it("collapses its section from the heading", () => {
    render(
      <Accordion type="multiple" defaultValue={["price"]}>
        <MarketingFilterAccordionSection value="price" title="Price">
          <p>Range inputs</p>
        </MarketingFilterAccordionSection>
      </Accordion>,
    );
    expect(screen.getByText("Range inputs")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Price" }));
    expect(screen.getByRole("button", { name: "Price" })).toHaveAttribute("aria-expanded", "false");
  });
});
