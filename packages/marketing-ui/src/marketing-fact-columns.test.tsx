import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFactColumns } from "./marketing-fact-columns.js";

describe("MarketingFactColumns", () => {
  it("renders each fact with its label, icon and lines", () => {
    render(
      <MarketingFactColumns
        ariaLabel="Exhibition details"
        facts={[
          {
            id: "location",
            icon: <svg data-testid="pin" />,
            label: "Location",
            lines: [
              "LAX Marylebone",
              <a key="map" href="https://maps.example">
                Map
              </a>,
            ],
          },
          { id: "viewing", icon: <svg />, label: "Viewing", lines: ["18 – 30 Sep 2026"] },
        ]}
      />,
    );
    expect(screen.getByLabelText("Exhibition details")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByTestId("pin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute(
      "href",
      "https://maps.example",
    );
    expect(screen.getByText("18 – 30 Sep 2026")).toBeInTheDocument();
  });

  it("drops facts without lines and renders nothing when none remain", () => {
    const { container, rerender } = render(
      <MarketingFactColumns
        ariaLabel="Details"
        facts={[
          { id: "a", icon: null, label: "Location", lines: [] },
          { id: "b", icon: null, label: "Contact", lines: ["info@example.com"] },
        ]}
      />,
    );
    expect(screen.queryByText("Location")).not.toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();

    rerender(
      <MarketingFactColumns
        ariaLabel="Details"
        facts={[{ id: "a", icon: null, label: "Location", lines: [] }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("stacks facts in a list layout with the icon beside the label and value", () => {
    render(
      <MarketingFactColumns
        ariaLabel="Venue details"
        layout="list"
        facts={[
          {
            id: "phone",
            icon: <svg data-testid="phone" />,
            label: "Gallery enquiries",
            lines: [
              <a key="p" href="tel:+4420">
                +44 20
              </a>,
            ],
          },
        ]}
      />,
    );
    const list = screen.getByLabelText("Venue details");
    expect(list).toHaveClass("flex-col");
    expect(list).not.toHaveClass("text-center");
    expect(screen.getByTestId("phone")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+44 20" })).toHaveAttribute("href", "tel:+4420");
  });
});
