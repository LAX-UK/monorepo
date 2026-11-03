/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingSection } from "./marketing-section";

const classes = (el: HTMLElement) => el.className.split(/\s+/);

describe("MarketingSection", () => {
  it("names the section by its heading and keeps the family rhythm", () => {
    const { container } = render(
      <MarketingSection id="home-press" heading="In the press">
        <p>body</p>
      </MarketingSection>,
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-labelledby")).toBe("home-press-heading");
    expect(classes(section as HTMLElement)).toEqual(expect.arrayContaining(["pt-16", "md:pt-24"]));
    expect(screen.getByRole("heading", { level: 2, name: "In the press" }).id).toBe(
      "home-press-heading",
    );
    expect(container.querySelector(".mt-5.md\\:mt-8")?.textContent).toBe("body");
  });

  it("uses the page heading scale by default", () => {
    render(
      <MarketingSection id="a" heading="Artists" subtitle="Sub">
        <p>x</p>
      </MarketingSection>,
    );
    expect(classes(screen.getByRole("heading"))).toEqual(
      expect.arrayContaining(["md:text-[40px]", "md:leading-[48px]"]),
    );
    expect(classes(screen.getByText("Sub"))).toContain("md:text-lg");
  });

  it("uses the compact heading scale for a department row", () => {
    render(
      <MarketingSection id="b" heading="On sale now" subtitle="Sub" size="compact">
        <p>x</p>
      </MarketingSection>,
    );
    const heading = classes(screen.getByRole("heading"));
    expect(heading).toEqual(expect.arrayContaining(["md:text-[32px]", "md:leading-10"]));
    expect(heading).not.toContain("md:text-[40px]");
    expect(classes(screen.getByText("Sub"))).not.toContain("md:text-lg");
  });

  it("renders the View all link with its screen-reader suffix, or no link without an action", () => {
    const { rerender } = render(
      <MarketingSection
        id="c"
        heading="Sold"
        action={{ href: "/sold", label: "View all", srSuffix: "sold in Prints" }}
      >
        <p>x</p>
      </MarketingSection>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/sold");
    expect(link.textContent).toContain("View all sold in Prints");
    rerender(
      <MarketingSection id="c" heading="Sold">
        <p>x</p>
      </MarketingSection>,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
