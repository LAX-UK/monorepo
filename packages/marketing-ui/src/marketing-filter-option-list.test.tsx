import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingFilterOptionList } from "./marketing-filter-option-list.js";

const OPTIONS = [
  { value: "print", label: "Prints", count: 7 },
  { value: "sculpture", label: "Sculpture", count: 0 },
  { value: "drawing", label: "Drawings" },
];

describe("MarketingFilterOptionList", () => {
  it("reads each count as part of the option's name", () => {
    render(
      <MarketingFilterOptionList
        legend="Medium"
        idPrefix="m"
        options={OPTIONS}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Prints , 7" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Sculpture , 0" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Drawings" })).toBeEnabled();
  });

  it("adds a chosen value to the others", () => {
    const onChange = vi.fn();
    render(
      <MarketingFilterOptionList
        legend="Medium"
        idPrefix="m"
        options={OPTIONS}
        selected={["drawing"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Prints , 7" }));
    expect(onChange).toHaveBeenCalledWith(["drawing", "print"]);
  });

  it("disables an empty radio option unless it is the chosen one", () => {
    render(
      <MarketingFilterOptionList
        legend="Availability"
        idPrefix="a"
        selection="single"
        options={[
          { value: "", label: "Any", count: 9 },
          { value: "sold", label: "Sold", count: 0 },
        ]}
        selected={[""]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "Sold , 0" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Any , 9" })).toBeEnabled();
  });
});
