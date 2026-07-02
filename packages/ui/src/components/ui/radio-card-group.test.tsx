import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioCardGroup } from "./radio-card-group.js";

const OPTIONS = [
  { value: "individual", label: "An individual", description: "Bid and buy." },
  { value: "organisation", label: "Organisation", description: "Sell and consign." },
] as const;

describe("RadioCardGroup", () => {
  it("renders options and forwards selection", () => {
    const onValueChange = vi.fn();
    render(
      <RadioCardGroup
        legend="I'm joining as…"
        value="individual"
        onValueChange={onValueChange}
        options={OPTIONS}
      />,
    );

    expect(screen.getByRole("group", { name: /i'm joining as/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /an individual/i })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /organisation/i }));
    expect(onValueChange).toHaveBeenCalledWith("organisation");
  });

  it("shows validation error", () => {
    render(
      <RadioCardGroup
        legend="Choose one"
        value=""
        onValueChange={vi.fn()}
        options={OPTIONS}
        error="Required"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});
