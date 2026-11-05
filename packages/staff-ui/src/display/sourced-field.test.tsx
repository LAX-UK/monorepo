import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceMark, SourcedField } from "./sourced-field.js";

describe("SourcedField", () => {
  it("shows the label, who owns the value and the value", () => {
    render(
      <SourcedField label="Medium" source="From Zoho">
        Oil on linen
      </SourcedField>,
    );
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Oil on linen")).toBeInTheDocument();
    expect(screen.getByText("From Zoho")).toBeInTheDocument();
  });

  it("is not an input: it takes no focus and offers nothing to type into", () => {
    render(
      <SourcedField label="Title" source="From Zoho">
        Tidal margin IV
      </SourcedField>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Tidal margin IV")).not.toHaveAttribute("tabindex");
  });

  it("says so when the owner holds no value yet, in muted text", () => {
    render(<SourcedField label="Dimensions" source="From Zoho" emptyText="Not in Zoho yet" />);
    const value = screen.getByText("Not in Zoho yet");
    expect(value.className).toContain("text-staff-muted");
  });
});

describe("SourceMark", () => {
  it("draws the lock as decoration and keeps the words", () => {
    const { container } = render(<SourceMark source="From Zoho" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("From Zoho")).toBeInTheDocument();
  });
});
