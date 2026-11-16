import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStatusAction } from "./marketing-status-state.js";

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

describe("MarketingStatusAction CSS", () => {
  const css = readFileSync(join(process.cwd(), "src/marketing-ui.css"), "utf8");

  it("switches off the transition and the press nudge for reduced motion", () => {
    const block = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .marketing-status-state__action"),
    );
    expect(block).toMatch(/\.marketing-status-state__action \{\s*transition: none;/);
    expect(block).toMatch(/\.marketing-status-state__action:active \{\s*transform: none;/);
  });

  it("stacks the actions full width on phones", () => {
    expect(css).toMatch(
      /@media \(max-width: 39\.99rem\) \{\s*\.marketing-status-state__action \{\s*flex: 1 1 100%;\s*width: 100%;/,
    );
  });
});
