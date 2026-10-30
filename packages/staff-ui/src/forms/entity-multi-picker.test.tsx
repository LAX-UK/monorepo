import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityMultiPicker } from "./entity-multi-picker.js";

const options = [
  { id: "c1", label: "Paintings" },
  { id: "c2", label: "Prints" },
  { id: "c3", label: "Ceramics" },
];

describe("EntityMultiPicker", () => {
  it("shows the chosen records as removable chips", () => {
    const change = vi.fn();
    render(
      <Field label="Categories">
        <EntityMultiPicker value={["c2", "c1"]} onValueChange={change} options={options} />
      </Field>,
    );
    const chosen = screen.getByRole("list", { name: "Chosen" });
    expect(
      within(chosen)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Prints", "Paintings"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Prints" }));
    expect(change).toHaveBeenCalledWith(["c1"]);
    expect(screen.getByRole("combobox", { name: "Categories" })).toBeInTheDocument();
  });

  it("hides the picker once the most allowed are chosen", () => {
    render(
      <EntityMultiPicker value={["c1", "c2"]} onValueChange={vi.fn()} options={options} max={2} />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
