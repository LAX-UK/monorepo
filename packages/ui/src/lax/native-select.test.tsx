import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Field } from "./field.js";
import { NativeSelect } from "./native-select.js";

const OPTIONS = [
  { value: "any", label: "Any sale" },
  { value: "s1", label: "Autumn online" },
] as const;

describe("NativeSelect", () => {
  it("is labelled by its field and reports the chosen option's value", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Sale" description="Bids in one sale">
        <NativeSelect value="any" onValueChange={onValueChange} options={OPTIONS} />
      </Field>,
    );
    const select = screen.getByRole("combobox", { name: "Sale" });
    expect(select).toHaveAccessibleDescription("Bids in one sale");
    expect(select).toHaveValue("any");
    fireEvent.change(select, { target: { value: "s1" } });
    expect(onValueChange).toHaveBeenCalledWith("s1");
  });

  it("sits in the shared field box, so it lines up with text inputs", () => {
    render(
      <NativeSelect aria-label="Sort" value="any" onValueChange={() => {}} options={OPTIONS} />,
    );
    const box = screen.getByRole("combobox", { name: "Sort" }).parentElement as HTMLElement;
    expect(box.className).toContain("rounded-lax-control");
    expect(box.className).toContain("h-lax-control-md");
  });
});
