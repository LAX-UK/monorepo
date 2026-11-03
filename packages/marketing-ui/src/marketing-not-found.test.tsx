// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingNotFound } from "./marketing-not-found.js";

const Link = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href}>{children}</a>
);

const base = {
  illustration: "ticket",
  title: "We can’t find that page",
  description: "The link may be mistyped.",
  links: [
    { href: "/artworks", label: "Browse artworks" },
    { href: "/artists", label: "See the artists" },
  ],
} as const;

afterEach(cleanup);

describe("MarketingNotFound", () => {
  it("is the page's h1 with one link per route, in order", () => {
    render(<MarketingNotFound {...base} Link={Link} />);
    expect(screen.getByRole("heading", { level: 1, name: "We can’t find that page" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/artworks",
      "/artists",
    ]);
  });

  it("puts search first and leaves every link secondary when a search field is shown", () => {
    render(
      <MarketingNotFound
        {...base}
        Link={Link}
        search={{ action: "/search", label: "Search artworks" }}
      />,
    );
    const form = screen.getByRole("form", { name: "Search artworks" });
    expect(form.getAttribute("action")).toBe("/search");
    expect(screen.getByRole("searchbox", { name: "Search artworks" }).getAttribute("name")).toBe(
      "q",
    );
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("shows a product's own actions in place of the links", () => {
    render(<MarketingNotFound {...base} links={[]} actions={<a href="/account">My account</a>} />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/account",
    ]);
  });

  it("shows no search field without one", () => {
    render(<MarketingNotFound {...base} />);
    expect(screen.queryByRole("form")).toBeNull();
  });
});
