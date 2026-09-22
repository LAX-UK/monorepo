/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStatusAction, MarketingStatusState } from "./marketing-status-state.js";

describe("MarketingStatusState", () => {
  it("renders inline placard without a live region by default", () => {
    render(
      <MarketingStatusState
        title="No artworks yet"
        description="Check back soon."
        motif="gallery"
        data-testid="state"
      />,
    );

    const root = screen.getByTestId("state");
    expect(root.className).toContain("marketing-status-state--inline");
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-live")).toBeNull();
    expect(screen.getByTestId("marketing-status-motif-gallery")).toBeTruthy();
  });

  it("renders page layout with a larger title shell", () => {
    render(
      <MarketingStatusState layout="page" title="Page empty" titleAs="h1" data-testid="page" />,
    );
    expect(screen.getByTestId("page").className).toContain("marketing-status-state--page");
    expect(screen.getByRole("heading", { level: 1, name: "Page empty" })).toBeTruthy();
  });

  it("renders banner layout compactly with assertive announcement when configured", () => {
    render(
      <MarketingStatusState
        layout="banner"
        variant="error"
        announcement="assertive"
        title="Catalogue unavailable"
        description="Try again shortly."
        actions={<MarketingStatusAction priority="primary">Retry</MarketingStatusAction>}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.className).toContain("marketing-status-state--banner");
    expect(screen.queryByTestId("marketing-status-motif-gallery")).toBeNull();
  });

  it("maps polite announcement to status semantics", () => {
    render(
      <MarketingStatusState announcement="polite" title="Updating" description="Please wait." />,
    );
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("composes primary and secondary actions with shared chrome", () => {
    render(
      <MarketingStatusState
        title="Empty basket"
        actions={
          <>
            <MarketingStatusAction priority="primary">Browse</MarketingStatusAction>
            <MarketingStatusAction>Sign in</MarketingStatusAction>
          </>
        }
      />,
    );
    expect(screen.getByRole("button", { name: "Browse" }).className).toContain(
      "marketing-status-state__action--primary",
    );
    expect(screen.getByRole("button", { name: "Sign in" }).className).toContain(
      "marketing-status-state__action--secondary",
    );
  });

  it("supports contextual motifs", () => {
    render(<MarketingStatusState title="No matches" motif="search" />);
    expect(screen.getByTestId("marketing-status-motif-search")).toBeTruthy();
  });
});
