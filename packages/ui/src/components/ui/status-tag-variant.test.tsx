import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DotStatusPill } from "./dot-status-pill.js";
import { STATUS_TAG_VARIANT } from "./status-tag-variant.js";

describe("status pill tones", () => {
  it.each(["live", "critical"] as const)("%s labels use the readable danger text token", (tone) => {
    expect(STATUS_TAG_VARIANT[tone].shell).toContain("text-danger-on-surface");
    expect(STATUS_TAG_VARIANT[tone].shell).not.toMatch(/text-live-red|text-danger(\s|$)/);
  });

  it.each(["info", "pending", "draft", "public"] as const)(
    "%s labels and glyph circles use the readable info ink, not the bright info fill",
    (tone) => {
      expect(STATUS_TAG_VARIANT[tone].shell).toContain("text-info-on-surface");
      expect(STATUS_TAG_VARIANT[tone].shell).not.toMatch(/text-info(\s|$)/);
      expect(STATUS_TAG_VARIANT[tone].iconBg).toBe("bg-info-on-surface");
    },
  );

  it("draws the warning glyph on the dark amber text token, not the bright fill", () => {
    expect(STATUS_TAG_VARIANT.warning.shell).toContain("text-warning-on-surface");
    expect(STATUS_TAG_VARIANT.warning.iconBg).toBe("bg-warning-on-surface");
  });

  it("keeps the glyph ink on the light gold circle", () => {
    const { container } = render(<DotStatusPill label="Featured" tone="accent" />);
    const glyph = container.querySelector("svg");
    expect(glyph).toHaveClass("text-brand-900");
    expect(glyph).not.toHaveClass("text-on-primary");
  });

  it("keeps the default glyph colour for the other tones", () => {
    const { container } = render(<DotStatusPill label="Needs changes" tone="warning" />);
    expect(container.querySelector("svg")).toHaveClass("text-on-primary");
    expect(container.firstElementChild).toHaveTextContent("Needs changes");
  });
});
