/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckoutTermsNotice } from "./checkout-terms-notice";

describe("CheckoutTermsNotice", () => {
  afterEach(cleanup);

  it("states the terms and the 14-day cancellation right with links to both pages", () => {
    render(<CheckoutTermsNotice />);
    const notice = screen.getByTestId("checkout-terms");
    expect(notice.textContent).toBe(
      "By placing your order you agree to our Terms of sale (opens in a new tab). You can cancel within 14 days of receiving your order: 14-day cancellation (opens in a new tab).",
    );
    const terms = screen.getByRole("link", { name: /Terms of sale/ });
    const returns = screen.getByRole("link", { name: /14-day cancellation/ });
    expect(terms.getAttribute("href")).toBe("/terms");
    expect(returns.getAttribute("href")).toBe("/returns");
    for (const link of [terms, returns]) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});
