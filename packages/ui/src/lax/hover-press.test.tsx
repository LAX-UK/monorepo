import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button as PublicButton } from "../components/ui/button.js";
import { Button } from "./button.js";

/**
 * Which buttons press (docs/design/motion.md, MO10). The press itself, and that the staff tools
 * and reduced motion turn it off, is proved in Chromium by hover-press-resolved.test.ts; this
 * checks the wiring: every button-shaped control carries `lax-press`, and text-shaped ones do not.
 */
const PRESSED = [
  "default",
  "primary",
  "cta",
  "destructive",
  "success",
  "outline",
  "secondary",
  "secondaryOutline",
  "ghost",
  "liveJoin",
] as const;
const TEXT = ["link", "tertiary", "ctaLink", "underline", "chevron"] as const;

describe("press scale on the public button", () => {
  for (const variant of PRESSED) {
    it(`${variant} presses`, () => {
      render(<PublicButton variant={variant}>Go</PublicButton>);
      expect(screen.getByRole("button", { name: "Go" })).toHaveClass("lax-press");
    });
  }

  for (const variant of TEXT) {
    it(`${variant} is text-shaped and does not press`, () => {
      render(<PublicButton variant={variant}>Go</PublicButton>);
      expect(screen.getByRole("button", { name: "Go" })).not.toHaveClass("lax-press");
    });
  }

  it("a button with a disabled reason keeps the class; the stylesheet skips aria-disabled", () => {
    render(<PublicButton disabledReason="Accept the terms first">Go</PublicButton>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveClass("lax-press");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});

describe("press scale on the LAX system button (LAX Account; the staff scope turns it off)", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger", "danger-secondary"] as const) {
    it(variant, () => {
      render(<Button variant={variant}>Save</Button>);
      expect(screen.getByRole("button", { name: "Save" })).toHaveClass("lax-press");
    });
  }
});
