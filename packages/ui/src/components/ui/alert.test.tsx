import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "./alert.js";

describe("Alert inverse variant", () => {
  it("uses the CTA fill and text tokens", () => {
    render(
      <Alert variant="inverse">
        <AlertTitle>You're almost ready</AlertTitle>
        <AlertDescription>Add a few more details.</AlertDescription>
      </Alert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-cta-bg");
    expect(alert.className).toContain("text-cta-on");
    expect(alert.className).toContain("[&>svg]:text-cta-on");
    expect(alert.className).not.toContain("[&>svg]:text-on-surface");
  });

  it("keeps the default variant unchanged", () => {
    render(<Alert>Saved</Alert>);
    expect(screen.getByRole("alert").className).toContain("bg-surface-container-low");
  });
});

describe("AlertTitle heading level", () => {
  it("is an h2 by default, so it follows the page title without skipping a level", () => {
    render(<AlertTitle>Could not load bids</AlertTitle>);
    expect(screen.getByRole("heading", { level: 2, name: "Could not load bids" })).toBeTruthy();
  });

  it("takes the level that fits where the alert sits", () => {
    render(<AlertTitle as="h3">Could not load bids</AlertTitle>);
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
  });
});
