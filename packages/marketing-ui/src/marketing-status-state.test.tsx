import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStatusAction, resolveStatusIllustration } from "./marketing-status-state.js";

describe("resolveStatusIllustration", () => {
  it("maps the older motif names to the LAX drawings", () => {
    expect(resolveStatusIllustration("gallery")).toBe("frame");
    expect(resolveStatusIllustration("search-remove")).toBe("search");
    expect(resolveStatusIllustration("bag")).toBe("parcel");
    expect(resolveStatusIllustration("alert")).toBe("askew");
  });

  it("passes the set's own names through", () => {
    expect(resolveStatusIllustration("ticket")).toBe("ticket");
    expect(resolveStatusIllustration("lock")).toBe("lock");
  });
});

describe("MarketingStatusAction", () => {
  it("renders a button with the priority class", () => {
    render(<MarketingStatusAction priority="primary">Try again</MarketingStatusAction>);
    const button = screen.getByRole("button", { name: "Try again" });
    expect(button).toHaveClass("marketing-status-state__action--primary");
  });

  it("renders its child element when asChild", () => {
    render(
      <MarketingStatusAction asChild>
        <a href="/x">Go</a>
      </MarketingStatusAction>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveClass("marketing-status-state__action");
  });
});
