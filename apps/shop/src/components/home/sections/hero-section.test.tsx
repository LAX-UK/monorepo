import { readFileSync } from "node:fs";
import { join } from "node:path";
/** @vitest-environment jsdom */
import { HeroSectionClient } from "@/components/home/sections/hero-section.client";
import { homeHero } from "@/content/home-marketing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("HeroSectionClient", () => {
  it("exposes one h1 and discover CTA", () => {
    render(<HeroSectionClient hero={homeHero} />);
    expect(screen.getByRole("heading", { level: 1, name: homeHero.title }).getAttribute("id")).toBe(
      "hero-heading",
    );
    expect(screen.getByRole("link", { name: homeHero.ctaLabel }).getAttribute("href")).toBe(
      homeHero.ctaHref,
    );
  });

  it("uses a bounded hero height with header-safe content padding", () => {
    const { container } = render(<HeroSectionClient hero={homeHero} />);
    expect(container.querySelector(".shop-home__hero")).toBeTruthy();
    const css = readFileSync(join(process.cwd(), "src/app/home.css"), "utf8");
    expect(css).toMatch(/\.shop-home__hero[\s\S]*min-height:\s*clamp\(/);
    expect(css).not.toMatch(/\.shop-home__hero[\s\S]*min-height:\s*100svh/);
    expect(css).toMatch(/\.shop-home__hero-panel[\s\S]*padding:\s*calc\(var\(--header-height/);
  });
});
