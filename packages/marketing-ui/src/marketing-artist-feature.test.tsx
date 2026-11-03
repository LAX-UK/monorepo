import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MarketingArtistFeature,
  MarketingArtistPair,
  MarketingArtistPairRow,
} from "./marketing-artist-feature.js";
import { MarketingArtistPortraitFill } from "./marketing-artist-portrait-fill.js";

const portrait = <MarketingArtistPortraitFill name="Flora Powers" />;

describe("MarketingArtistPortraitFill", () => {
  it("shows the image when there is one", () => {
    render(<MarketingArtistPortraitFill name="Flora Powers" image={<img alt="" src="/p.jpg" />} />);
    expect(screen.queryByText("FP")).toBeNull();
  });

  it("falls back to the artist's initials", () => {
    render(portrait);
    expect(screen.getByText("FP")).toBeInTheDocument();
  });
});

describe("MarketingArtistFeature", () => {
  it("shows the copy and actions it is given", () => {
    render(
      <MarketingArtistFeature
        name="Flora Powers"
        href="/artists/flora-powers"
        portrait={portrait}
        eyebrow="The artist"
        facts="British · b. 1979 · Painter"
        bio="Paints quiet interiors."
        count="4 works"
        actions={<a href="/artists/flora-powers">Works by Flora Powers</a>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Flora Powers" })).toBeInTheDocument();
    for (const text of [
      "The artist",
      "British · b. 1979 · Painter",
      "Paints quiet interiors.",
      "4 works",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Works by Flora Powers" })).toBeInTheDocument();
  });

  it("leaves out facts, bio and count that are empty", () => {
    render(
      <MarketingArtistFeature
        name="Flora Powers"
        href="/artists/flora-powers"
        portrait={portrait}
        facts={null}
        bio=""
        count={null}
      />,
    );
    expect(screen.queryByText("4 works")).toBeNull();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("keeps the portrait out of the tab order and the accessibility tree", () => {
    const { container } = render(
      <MarketingArtistFeature name="Flora Powers" href="/a" portrait={portrait} />,
    );
    const link = container.querySelector('a[aria-hidden="true"]');
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).toHaveAttribute("href", "/a");
  });
});

describe("MarketingArtistPair", () => {
  it("lists each artist with name, facts, count and a labelled link", () => {
    render(
      <MarketingArtistPair aria-label="Featured artists">
        <li>
          <MarketingArtistPairRow
            name="Flora Powers"
            href="/artists/flora-powers"
            portrait={portrait}
            facts="Painter"
            count="4 works"
            linkLabel="Works by Flora Powers"
          />
        </li>
        <li>
          <MarketingArtistPairRow
            name="Theo Marsh"
            href="/artists/theo-marsh"
            portrait={portrait}
            linkLabel="Works by Theo Marsh"
          />
        </li>
      </MarketingArtistPair>,
    );
    const list = screen.getByRole("list", { name: "Featured artists" });
    const [first, second] = within(list).getAllByRole("listitem");
    expect(within(first as HTMLElement).getByText("Painter")).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText("4 works")).toBeInTheDocument();
    expect(
      within(second as HTMLElement).getByRole("link", { name: "Works by Theo Marsh" }),
    ).toHaveAttribute("href", "/artists/theo-marsh");
    expect(within(second as HTMLElement).queryByText("Painter")).toBeNull();
  });
});
