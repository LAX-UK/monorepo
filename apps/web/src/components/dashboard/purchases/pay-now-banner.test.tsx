import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PayNowBanner } from "./pay-now-banner";

describe("PayNowBanner", () => {
  it("says what is due and links to checkout", () => {
    render(
      <PayNowBanner
        banner={{
          title: "Pay for lot 5 by 7 November",
          description: "Ruby and gold ring · £8,000.00 including buyer's premium",
          href: "/purchases/checkout/lot-5",
        }}
      />,
    );
    expect(screen.getByRole("region", { name: "Payment due" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pay for lot 5 by 7 November" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute(
      "href",
      "/purchases/checkout/lot-5",
    );
  });

  it("offers no button while every due lot is being reviewed", () => {
    render(
      <PayNowBanner
        banner={{ title: "We're reviewing your account", description: "Soon.", href: null }}
      />,
    );
    expect(screen.queryByRole("link", { name: "Pay now" })).toBeNull();
  });
});
