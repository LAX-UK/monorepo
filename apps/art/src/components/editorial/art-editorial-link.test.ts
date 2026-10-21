import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtEditorialLink } from "./art-editorial-link";

function render(href: string | null) {
  return renderToStaticMarkup(createElement(ArtEditorialLink, { href }, "The Art Newspaper"));
}

describe("ArtEditorialLink", () => {
  it("opens external links in a new tab and tells screen readers so", () => {
    const html = render("https://www.theartnewspaper.com/lax");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<span class="sr-only"> (opens in a new tab)</span>');
  });

  it("keeps site paths in the same tab without the new-tab notice", () => {
    const html = render("/stories/press");
    expect(html).not.toContain("_blank");
    expect(html).not.toContain("opens in a new tab");
  });

  it("renders unsafe links as plain text", () => {
    expect(render("javascript:alert(1)")).toBe("<span>The Art Newspaper</span>");
  });
});
