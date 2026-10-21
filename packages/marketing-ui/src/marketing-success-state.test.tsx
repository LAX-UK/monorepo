import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingSuccessState } from "./marketing-success-state.js";

describe("MarketingSuccessState", () => {
  it("announces the title and description as a polite status", () => {
    render(<MarketingSuccessState title="Enquiry sent" description="We will be in touch." />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Enquiry sent");
    expect(status).toHaveTextContent("We will be in touch.");
  });

  it("hides the decorative check from assistive technology", () => {
    render(<MarketingSuccessState title="Sent" />);
    expect(screen.getByTestId("marketing-success-check")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders actions and accepts focus props for moving focus to the confirmation", () => {
    render(
      <MarketingSuccessState title="Sent" tabIndex={-1} actions={<a href="/next">Continue</a>} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("link", { name: "Continue" })).toBeInTheDocument();
  });

  it("stops the drawing animation under prefers-reduced-motion", () => {
    const css = readFileSync(join(process.cwd(), "src/marketing-ui.css"), "utf8");
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".marketing-success-state__tick");
    expect(reduced).toContain("animation: none");
  });
});
