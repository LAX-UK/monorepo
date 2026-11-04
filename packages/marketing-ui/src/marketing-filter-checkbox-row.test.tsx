import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingFilterCheckboxRow } from "./marketing-filter-checkbox-row.js";

function row(props: Partial<Parameters<typeof MarketingFilterCheckboxRow>[0]> = {}) {
  const onCheckedChange = vi.fn();
  render(
    <MarketingFilterCheckboxRow
      id="medium-paintings"
      label="Paintings"
      count={12}
      checked={false}
      onCheckedChange={onCheckedChange}
      {...props}
    />,
  );
  return onCheckedChange;
}

describe("MarketingFilterCheckboxRow", () => {
  it("is a checkbox whose name carries the count", () => {
    row();
    expect(screen.getByRole("checkbox", { name: "Paintings , 12" })).toBeInTheDocument();
  });

  it("reports the new state when it is chosen", () => {
    const onCheckedChange = row();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
  });

  it("takes a chosen option off", () => {
    const onCheckedChange = row({ checked: true });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("disables an option with no works", () => {
    row({ count: 0 });
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("keeps a chosen option with no works enabled so it can be taken off", () => {
    row({ count: 0, checked: true });
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });

  it("has no count in its name when counts are not offered", () => {
    row({ count: undefined });
    expect(screen.getByRole("checkbox", { name: "Paintings" })).toBeInTheDocument();
  });
});
