import { dealHoldLine } from "@/lib/admin/data-requests/deal-holds";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealHoldsSection } from "./deal-holds-section";

describe("dealHoldLine", () => {
  it("says until when a deal that ended keeps the records", () => {
    expect(
      dealHoldLine({
        dealReference: "PS-0012",
        status: "running",
        heldUntil: "2031-11-03T00:00:00.000Z",
      }),
    ).toEqual({ reference: "PS-0012", text: "Kept until 3 November 2031" });
  });

  it("says an open deal keeps them until it ends", () => {
    expect(
      dealHoldLine({ dealReference: "PS-0013", status: "open", heldUntil: null }).text,
    ).toMatch(/until the deal ends/);
  });

  it("says plainly when a deal's end is not recorded, and that compliance has been asked", () => {
    expect(
      dealHoldLine({ dealReference: "PS-0014", status: "end_unknown", heldUntil: null }).text,
    ).toMatch(/end is not recorded.*compliance/);
  });
});

describe("DealHoldsSection", () => {
  it("shows nothing for someone on no deal", () => {
    const { container } = render(<DealHoldsSection holds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each deal with its reference and the date", () => {
    render(
      <DealHoldsSection
        holds={[
          { dealReference: "PS-0012", status: "running", heldUntil: "2031-11-03T00:00:00.000Z" },
          { dealReference: "PS-0013", status: "open", heldUntil: null },
        ]}
      />,
    );
    expect(screen.getByText("Kept for a private sale")).toBeInTheDocument();
    expect(screen.getByText("PS-0012")).toBeInTheDocument();
    expect(screen.getByText("Kept until 3 November 2031")).toBeInTheDocument();
    expect(screen.getByText("PS-0013")).toBeInTheDocument();
  });
});
