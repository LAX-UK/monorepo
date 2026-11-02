import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox.js";

describe("Checkbox", () => {
  it("is a checkbox with the name it is given and reports each change", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Pay Lot 12" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox", { name: "Pay Lot 12" });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("draws the ink fill when on and the dash when indeterminate", () => {
    const { rerender } = render(<Checkbox aria-label="Select all" checked />);
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(box).toHaveAttribute("data-state", "checked");
    expect(box.className).toContain("data-[state=checked]:bg-lax-ink");
    rerender(<Checkbox aria-label="Select all" checked="indeterminate" />);
    expect(box).toHaveAttribute("aria-checked", "mixed");
    expect(box).toHaveAttribute("data-state", "indeterminate");
  });

  it("is one size scale: 16px, 20px in the client workspace, a 4px radius", () => {
    render(<Checkbox aria-label="Select" />);
    const className = screen.getByRole("checkbox", { name: "Select" }).className;
    expect(className).toContain("size-4");
    expect(className).toContain("in-data-[lax-density=client]:size-5");
    expect(className).toContain("rounded-lax-badge");
  });

  it("does not respond when disabled", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Select" disabled onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
