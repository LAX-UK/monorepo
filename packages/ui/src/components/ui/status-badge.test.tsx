import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveBadge } from "./live-badge.js";
import {
  STATUS_BADGE_DEFAULT_SHAPE,
  STATUS_BADGE_TONE_CLASSES,
  StatusBadge,
  type StatusBadgeShape,
  type StatusBadgeTone,
} from "./status-badge.js";

const TONES = Object.keys(STATUS_BADGE_TONE_CLASSES) as StatusBadgeTone[];
const SHAPES: StatusBadgeShape[] = ["ring", "dot", "check", "alert"];

function badge(label = "Under review") {
  return screen.getByText(label).closest("[data-tone]") as HTMLElement;
}

describe("StatusBadge", () => {
  it("is one size: 20px tall, 12px label at weight 500, on the LAX badge radius", () => {
    render(<StatusBadge>Under review</StatusBadge>);
    expect(badge()).toHaveClass("h-5", "text-xs", "font-medium");
    // 4px wherever the LAX system is loaded (Bid, both staff tools); a pill in other products.
    expect(badge()).toHaveClass("rounded-[var(--lax-radius-badge,9999px)]");
  });

  it("never changes the case or spacing of its label", () => {
    render(<StatusBadge>Under review</StatusBadge>);
    const { className } = badge();
    expect(className).not.toMatch(/uppercase|tracking-/);
    expect(className).not.toMatch(/text-\[1[01]px\]/);
  });

  it("is neutral with a hollow ring when no tone is given", () => {
    render(<StatusBadge>Under review</StatusBadge>);
    expect(badge()).toHaveAttribute("data-tone", "neutral");
    expect(badge().querySelector("[data-shape]")).toHaveAttribute("data-shape", "ring");
  });

  describe.each(TONES)("%s tone", (tone) => {
    it("draws its tint and label colour from the tone table", () => {
      render(<StatusBadge tone={tone}>Under review</StatusBadge>);
      for (const token of STATUS_BADGE_TONE_CLASSES[tone].split(" ")) {
        expect(badge()).toHaveClass(token);
      }
    });

    it("pairs its colour with a cue, so it never relies on hue alone", () => {
      render(<StatusBadge tone={tone}>Under review</StatusBadge>);
      const cue = badge().querySelector("[data-shape]");
      expect(cue).toHaveAttribute("data-shape", STATUS_BADGE_DEFAULT_SHAPE[tone]);
      expect(cue).toHaveAttribute("aria-hidden", "true");
    });

    it.each(SHAPES)("can draw the %s cue instead", (shape) => {
      render(
        <StatusBadge tone={tone} shape={shape}>
          Under review
        </StatusBadge>,
      );
      expect(badge().querySelectorAll("[data-shape]")).toHaveLength(1);
      expect(badge().querySelector("[data-shape]")).toHaveAttribute("data-shape", shape);
    });
  });

  it("maps each kind of state to its cue: not started, in progress, done, blocked", () => {
    expect(STATUS_BADGE_DEFAULT_SHAPE).toEqual({
      neutral: "ring",
      info: "dot",
      success: "check",
      warning: "alert",
      danger: "alert",
      live: "dot",
    });
  });

  it("pulses its dot only for something live, and only when motion is allowed", () => {
    const { unmount } = render(<StatusBadge tone="live">Live</StatusBadge>);
    expect(badge("Live").querySelector("[data-shape] > span")).toHaveClass(
      "motion-safe:animate-pulse",
    );
    unmount();
    render(
      <StatusBadge tone="warning" shape="dot">
        Extended
      </StatusBadge>,
    );
    expect(badge("Extended").querySelector("[data-shape] > span")).not.toHaveClass(
      "motion-safe:animate-pulse",
    );
  });

  it("never cuts its label short, since the words are the status", () => {
    render(<StatusBadge>Documents requested by our team</StatusBadge>);
    expect(screen.getByText("Documents requested by our team")).not.toHaveClass("truncate");
    expect(badge("Documents requested by our team").className).not.toMatch(/truncate|max-w-/);
    expect(badge("Documents requested by our team")).toHaveClass("shrink-0", "whitespace-nowrap");
  });

  it("reads as its words alone to assistive technology", () => {
    render(
      <p>
        Status: <StatusBadge tone="success">Approved</StatusBadge>
      </p>,
    );
    expect(screen.getByText(/Status:/).textContent).toBe("Status: Approved");
  });
});

describe("LiveBadge", () => {
  it("is the live tone with a dot, labelled Live by default", () => {
    render(<LiveBadge />);
    expect(badge("Live")).toHaveAttribute("data-tone", "live");
    expect(badge("Live").querySelector("[data-shape]")).toHaveAttribute("data-shape", "dot");
  });
});
