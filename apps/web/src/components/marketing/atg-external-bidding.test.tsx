import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AtgExternalBiddingPanel } from "./atg-external-bidding";

describe("AtgExternalBiddingPanel", () => {
  it("renders nothing for ordinary draft sales", () => {
    const { container } = render(
      <AtgExternalBiddingPanel sale={{ status: "draft", sellingPlatform: "free" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the White Label for ATG-owned sales", () => {
    render(<AtgExternalBiddingPanel sale={{ status: "draft", sellingPlatform: "atg" }} />);
    expect(screen.getByRole("link", { name: /Bid on auctions.lax.bid/i })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https?:\/\//),
    );
  });
});
