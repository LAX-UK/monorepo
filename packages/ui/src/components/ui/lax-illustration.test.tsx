import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state.js";
import { LAX_ILLUSTRATION_NAMES, LaxIllustration } from "./lax-illustration.js";
import { MediaPlaceholder, placeholderInitials } from "./media-placeholder.js";

describe("LaxIllustration", () => {
  it.each(LAX_ILLUSTRATION_NAMES)(
    "draws %s as a decorative, single-weight line drawing",
    (name) => {
      const { container } = render(<LaxIllustration name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("stroke-width", "1.5");
      expect(svg).toHaveAttribute("fill", "none");
      for (const path of container.querySelectorAll("path")) {
        expect(path).toHaveAttribute("vector-effect", "non-scaling-stroke");
      }
    },
  );

  it("only animates when the person has not asked for reduced motion", () => {
    const { container } = render(<LaxIllustration name="frame" />);
    expect(container.querySelector("style")?.textContent).toContain(
      "prefers-reduced-motion:no-preference",
    );
  });
});

describe("EmptyState", () => {
  it("draws a named illustration above the title and sentence", () => {
    const { container } = render(
      <EmptyState
        illustration="parcel"
        size="compact"
        title="No orders yet"
        description="Orders appear here."
      />,
    );
    expect(container.querySelector('svg[data-illustration="parcel"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "No orders yet" })).toBeInTheDocument();
  });
});

describe("MediaPlaceholder", () => {
  it("sets the work's initials on the mat instead of a generic label", () => {
    render(<MediaPlaceholder label="Lot artwork" title="The Blue Hour, 2021" />);
    const mat = screen.getByRole("img", { name: "Lot artwork placeholder" });
    expect(mat).toHaveTextContent("BH");
    expect(mat).not.toHaveTextContent("Lot artwork");
  });

  it("reads short labels as initials", () => {
    expect(placeholderInitials("ma")).toBe("MA");
    expect(placeholderInitials("Untitled 7")).toBeNull();
  });
});
