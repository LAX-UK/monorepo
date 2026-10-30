import { Field, ReadOnlyView, TextInput } from "@auction/ui/lax";
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnumSelect } from "../forms/enum-select.js";
import { StaffCheckbox } from "../primitives/choice.js";

function form() {
  return (
    <>
      <Field label="Title">
        <TextInput defaultValue="Harbour" />
      </Field>
      <Field label="Kind">
        <EnumSelect
          value="film"
          options={[{ value: "film", label: "Film" }]}
          onValueChange={() => {}}
        />
      </Field>
      <StaffCheckbox aria-label="Featured" checked />
    </>
  );
}

describe("ReadOnlyView", () => {
  it("shows values as read-only content: no disabled controls, the select as text", () => {
    render(<ReadOnlyView>{form()}</ReadOnlyView>);
    const title = screen.getByLabelText("Title");
    expect(title).toHaveAttribute("readonly");
    expect(title).not.toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Kind" })).toHaveTextContent("Film");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("img", { name: "Yes" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("leaves a normal form editable", () => {
    render(form());
    expect(screen.getByLabelText("Title")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
