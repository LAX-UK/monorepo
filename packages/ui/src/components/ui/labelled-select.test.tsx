import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabelledSelect, type SelectOption } from "./labelled-select.js";

const ROLES: SelectOption<"admin" | "buyer_agent">[] = [
  { value: "admin", label: "Admin" },
  { value: "buyer_agent", label: "Buyer agent" },
];

describe("LabelledSelect", () => {
  it("names the trigger with its visible label", () => {
    render(<LabelledSelect label="Role" options={ROLES} />);
    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByText("Role")).not.toHaveClass("sr-only");
  });

  it("keeps the label for screen readers only when asked", () => {
    render(<LabelledSelect label="Role" hideLabel options={ROLES} />);
    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByText("Role")).toHaveClass("sr-only");
  });

  it("accepts an aria-label for a compact picker in a row", () => {
    render(<LabelledSelect aria-label="Role for Lena Fischer" options={ROLES} />);
    expect(screen.getByRole("combobox", { name: "Role for Lena Fischer" })).toBeInTheDocument();
  });

  it("accepts aria-labelledby pointing at text already on the page", () => {
    render(
      <>
        <span id="member-name">Lena Fischer</span>
        <LabelledSelect aria-labelledby="member-name" options={ROLES} />
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Lena Fischer" })).toBeInTheDocument();
  });

  it("shows the chosen option's words, never the stored value", () => {
    render(<LabelledSelect label="Role" options={ROLES} value="buyer_agent" />);
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent("Buyer agent");
  });

  it("describes the trigger with its hint and error, and marks it invalid", () => {
    render(
      <LabelledSelect
        label="Role"
        hint="Only roles you may grant are listed"
        error="Choose a role"
        options={ROLES}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Role" });
    expect(trigger).toHaveAccessibleDescription(
      "Only roles you may grant are listed Choose a role",
    );
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });

  it("requires exactly one accessible name at the type level", () => {
    // @ts-expect-error a select without a label, aria-label or aria-labelledby does not compile
    const unnamed = <LabelledSelect options={ROLES} />;
    // @ts-expect-error two sources for the name are ambiguous and do not compile
    const twice = <LabelledSelect label="Role" aria-label="Role" options={ROLES} />;
    expect([unnamed, twice]).toHaveLength(2);
  });
});
