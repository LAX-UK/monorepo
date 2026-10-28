import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoppedMemberBidsSection } from "./stopped-member-bids-section";

describe("StoppedMemberBidsSection", () => {
  it("shows nothing when no automatic bids stopped", () => {
    const { container } = render(<StoppedMemberBidsSection entityName="Northbank" stopped={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists what stopped per former member, with nothing to act on", () => {
    render(
      <StoppedMemberBidsSection
        entityName="Northbank Gallery"
        stopped={[
          {
            memberUserId: "sam",
            memberName: "Sam Lee",
            stoppedAt: "2026-10-28T09:00:00.000Z",
            bids: [
              {
                kind: "auto_bid",
                lotId: "l1",
                lotTitle: "Harbour at Dusk",
                lotNumber: 14,
                maxAmount: "6200.00",
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText("Sam Lee")).toBeVisible();
    expect(screen.getByText("Lot 14 · Harbour at Dusk")).toBeVisible();
    expect(screen.getByText(/Automatic bid up to £6,200\.00/)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
