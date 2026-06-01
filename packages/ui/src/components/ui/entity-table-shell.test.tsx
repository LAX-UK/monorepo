import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntityTableShell } from "./entity-table-shell.js";
import { Toolbar } from "./toolbar.js";

describe("EntityTableShell", () => {
  it("omits toolbar chrome when only table is provided", () => {
    const { container } = render(
      <EntityTableShell table={<table data-testid="data-table" />} responsiveMode="scroll" />,
    );

    expect(container.querySelector('[class*="rounded-2xl"]')).toBeNull();
    expect(screen.getByTestId("data-table")).toBeInTheDocument();
  });

  it("renders toolbar when search is provided", () => {
    const { container } = render(
      <EntityTableShell
        table={<table />}
        search={<input aria-label="Search entities" />}
        responsiveMode="scroll"
      />,
    );

    expect(screen.getByLabelText("Search entities")).toBeInTheDocument();
    expect(container.querySelector('[class*="rounded-2xl"]')).not.toBeNull();
  });

  it("renders toolbar when filters are provided", () => {
    render(
      <EntityTableShell
        table={<table />}
        filters={<span>Status: Active</span>}
        responsiveMode="scroll"
      />,
    );

    expect(screen.getByText("Status: Active")).toBeInTheDocument();
  });
});

describe("Toolbar", () => {
  it("returns null when all slots are empty", () => {
    const { container } = render(<Toolbar />);
    expect(container.firstChild).toBeNull();
  });
});
