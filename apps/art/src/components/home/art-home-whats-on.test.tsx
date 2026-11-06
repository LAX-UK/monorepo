import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtHomeWhatsOn } from "./art-home-whats-on";

const lead: EditorialCardVm = {
  key: "a",
  href: "/exhibitions/a",
  headline: "Forms in Suspension",
  kicker: "Exhibition",
  kickerDetail: "Marylebone",
  meta: "1 Oct – 12 Dec 2026",
  imageUrl: "https://cdn.test/a.jpg",
  actions: [
    { label: "Visit", href: "/exhibitions/a" },
    { label: "See the works", href: "/exhibitions/a#works" },
  ],
};
const second: EditorialCardVm = {
  key: "b",
  href: "/exhibitions/b",
  headline: "Second show",
  kicker: "Exhibition",
  kickerDetail: "Soho",
  meta: null,
  imageUrl: null,
};

describe("ArtHomeWhatsOn", () => {
  it("renders nothing without exhibitions", () => {
    expect(renderToStaticMarkup(<ArtHomeWhatsOn cards={[]} />)).toBe("");
  });

  it("renders the lead as a split card with its eyebrow, dates and two actions", () => {
    const html = renderToStaticMarkup(<ArtHomeWhatsOn cards={[lead]} />);
    expect(html).toContain('data-layout="split"');
    expect(html).toContain("Exhibition");
    expect(html).toContain("Marylebone");
    expect(html).toContain("1 Oct – 12 Dec 2026");
    expect(html).toContain(">Visit<");
    expect(html).toContain('href="/exhibitions/a#works"');
    expect(html).toContain(">See the works<");
    expect(html).not.toContain("lg:grid-cols");
  });

  it("puts a second exhibition beside it as a stacked image card, with its frame even without an image", () => {
    const html = renderToStaticMarkup(<ArtHomeWhatsOn cards={[lead, second]} />);
    expect(html).toContain("lg:grid-cols");
    expect(html.match(/data-testid="art-editorial-card"/g)).toHaveLength(2);
    expect(html).toContain('data-layout="stacked"');
    expect(html).not.toContain("data-text-led");
    expect(html.match(/See the works/g)).toHaveLength(1);
  });
});
