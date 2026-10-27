import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BiddingAsLine } from "./bidding-as-line";

describe("BiddingAsLine", () => {
  it("names the organisation and a buyer agent's limit", () => {
    render(
      <BiddingAsLine
        account={{
          kind: "organisation",
          name: "Northbank Gallery",
          allowed: true,
          bidLimit: 10000,
        }}
      />,
    );
    const line = screen.getByTestId("bidding-as");
    expect(line.textContent).toBe(
      "Bidding as Northbank Gallery· Your limit for this sale: £10,000",
    );
  });

  it("names the organisation without a limit for owners and admins", () => {
    render(
      <BiddingAsLine
        account={{ kind: "organisation", name: "Northbank Gallery", allowed: true, bidLimit: null }}
      />,
    );
    expect(screen.getByTestId("bidding-as").textContent).toBe("Bidding as Northbank Gallery");
  });

  it("says bidding as you on a personal account", () => {
    render(<BiddingAsLine account={{ kind: "personal", hasOrganisations: true }} />);
    expect(screen.getByTestId("bidding-as").textContent).toBe("Bidding as you");
  });
});
