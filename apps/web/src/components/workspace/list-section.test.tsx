import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSection } from "./list-section";

describe("ListSection", () => {
  it("labels the section by its heading and shows the count and description", () => {
    render(
      <ListSection id="phone" title="Telephone bids" count={3} description="Lines you booked.">
        <p>rows</p>
      </ListSection>,
    );
    const section = screen.getByRole("region", { name: "Telephone bids" });
    expect(section).toContainElement(screen.getByText("rows"));
    expect(screen.getByRole("heading", { level: 2, name: "Telephone bids" })).toHaveAttribute(
      "id",
      "phone",
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Lines you booked.")).toBeInTheDocument();
  });

  it("leaves the count out when it is not known (the list did not load)", () => {
    render(
      <ListSection id="cr" title="Condition reports">
        <p>error</p>
      </ListSection>,
    );
    expect(
      screen.getByRole("heading", { name: "Condition reports" }).parentElement,
    ).toHaveTextContent(/^Condition reports$/);
  });
});
