import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";
import { LoadingButton } from "./loading-button.js";

describe("Button underline variant", () => {
  it("renders an underlined text action that keeps the 44px tap target", () => {
    render(<Button variant="underline">Enquire</Button>);
    const button = screen.getByRole("button", { name: "Enquire" });
    expect(button.className).toContain("underline");
    expect(button.className).toContain("min-h-[var(--tap-target-min,44px)]");
    expect(button.className).toContain("px-0");
    expect(button.className).not.toContain("px-6");
  });

  it("ignores block sizes so the text stays flush with surrounding copy", () => {
    render(
      <Button variant="underline" size="lg">
        Enquire
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Enquire" }).className).not.toContain("px-8");
  });
});

describe("Button label case", () => {
  it.each([
    "default",
    "primary",
    "secondaryOutline",
    "tertiary",
    "ctaLink",
    "underline",
    "cta",
    "liveJoin",
    "chevron",
  ] as const)("keeps %s labels in the case they are written in", (variant) => {
    render(<Button variant={variant}>Sign in</Button>);
    const { className } = screen.getByRole("button", { name: "Sign in" });
    expect(className).not.toContain("uppercase");
    expect(className).not.toMatch(/tracking-\[(var\(--text-label-caps|0\.18em)/);
  });
});

describe("Button primary", () => {
  const classesOf = (variant: "primary" | "cta") => {
    const { unmount } = render(<Button variant={variant}>Place bid</Button>);
    const { className } = screen.getByRole("button", { name: "Place bid" });
    unmount();
    return className;
  };

  it("is one flat button whether a page asks for primary or cta", () => {
    expect(classesOf("cta")).toBe(classesOf("primary"));
  });

  it("fills with the product's ink and its on-ink text, without a gradient or shadow", () => {
    const className = classesOf("primary");
    expect(className).toContain("bg-cta-bg");
    expect(className).toContain("text-cta-on");
    expect(className).toContain("shadow-none");
    expect(className).not.toMatch(/gradient|from-primary|to-primary/);
  });

  it("steps the fill on hover and press through the product's tokens", () => {
    const className = classesOf("primary");
    expect(className).toContain("hover:bg-[var(--color-cta-bg-hover,");
    expect(className).toContain("active:bg-[var(--color-cta-bg-pressed,");
    expect(className).not.toContain("hover:opacity-95");
  });

  it("draws the product's focus ring and keeps the shared disabled state", () => {
    const className = classesOf("primary");
    expect(className).toContain("focus-visible:ring-2");
    expect(className).toContain("focus-visible:ring-ring");
    expect(className).not.toContain("focus-visible:ring-primary");
    expect(className).toContain("disabled:opacity-50");
  });
});

describe("LoadingButton primary", () => {
  it("keeps the primary fill, shows a spinner and blocks a second press while loading", () => {
    render(
      <LoadingButton variant="primary" loading loadingLabel="Placing bid">
        Place bid
      </LoadingButton>,
    );
    const button = screen.getByRole("button", { name: "Placing bid" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.className).toContain("bg-cta-bg");
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
