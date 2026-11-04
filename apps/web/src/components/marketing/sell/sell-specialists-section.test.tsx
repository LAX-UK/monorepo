import { SellSpecialistsSection } from "@/components/marketing/sell/sell-specialists-section";
import { SELL_SPECIALISTS } from "@/lib/marketing/sell-specialists";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SellSpecialistsSection", () => {
  it("is hidden until specialists are supplied", () => {
    expect(SELL_SPECIALISTS).toHaveLength(0);
    const { container } = render(<SellSpecialistsSection specialists={SELL_SPECIALISTS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden when nobody has a photograph", () => {
    const { container } = render(
      <SellSpecialistsSection
        specialists={[{ id: "a", name: "Ada Moore", role: "Head of Prints", photoUrl: " " }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each specialist's name and role", () => {
    render(
      <SellSpecialistsSection
        specialists={[
          { id: "a", name: "Ada Moore", role: "Head of Prints", photoUrl: "/a.jpg" },
          { id: "b", name: "Ben Hale", role: "Watch specialist", photoUrl: "/b.jpg" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Our specialists" })).toBeInTheDocument();
    expect(screen.getByText("Ada Moore")).toBeInTheDocument();
    expect(screen.getByText("Watch specialist")).toBeInTheDocument();
  });
});
