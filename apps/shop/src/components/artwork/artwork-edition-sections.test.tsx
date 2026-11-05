/** @vitest-environment jsdom */
import { ArtworkAboutWork } from "@/components/artwork/artwork-about-work";
import { ArtworkArtistSummary } from "@/components/artwork/artwork-artist-summary";
import { ArtworkBuyColumn } from "@/components/artwork/artwork-buy-column";
import { ArtworkEditionFacts } from "@/components/artwork/artwork-edition-facts";
import { ArtworkMoreBy } from "@/components/artwork/artwork-more-by";
import { buildArtworkProductPage } from "@/lib/artwork/artwork-product-page.vm";
import type {
  PublicArtistDetail,
  PublicArtworkDetail,
  PublicArtworkEdition,
  PublicArtworkSummary,
} from "@auction/shop-contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => (
    // biome-ignore lint/a11y/useAltText: alt is passed through from props
    <img {...props} />
  ),
}));

const ART = new URL("https://www.thelax.art/");

const handSigned = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
} as const;

function summary(
  slug: string,
  state: "available" | "sold_out" = "available",
): PublicArtworkSummary {
  return {
    slug,
    title: `Title ${slug}`,
    artistName: "Emmett King",
    artistSlug: "emmett-king",
    imageUrl: `/${slug}.webp`,
    saleState: "for_sale",
    dimensions: null,
    medium: "Giclée print",
    yearCreated: 2025,
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 12_000,
    availability: { totalEditions: 24, state },
  };
}

function detail(
  edition: PublicArtworkEdition | null = {
    run: { kind: "limited", size: 24 },
    facts: handSigned,
    proofsKept: { ap: 0, pp: 0, hc: 0 },
    otherRuns: [],
  },
  overrides: Partial<PublicArtworkDetail> = {},
): PublicArtworkDetail {
  return {
    ...summary("warm-basket"),
    title: "Warm Basket",
    description: "A still life of a basket.",
    images: [],
    heightCm: 60,
    widthCm: 45,
    depthCm: null,
    hasCertificate: true,
    printPaper: "Cotton rag",
    printSize: "76 × 56 cm",
    sourceOriginalSlug: "warm-basket-original",
    edition,
    ...overrides,
  };
}

function vmFor(
  artwork: PublicArtworkDetail,
  extra: Partial<Parameters<typeof buildArtworkProductPage>[0]> = {},
) {
  return buildArtworkProductPage({ artwork, artistEditions: [], artBaseUrl: ART, ...extra });
}

function artist(overrides: Partial<PublicArtistDetail> = {}): PublicArtistDetail {
  return {
    slug: "emmett-king",
    name: "Emmett King",
    discipline: null,
    portraitUrl: null,
    artworkCount: 3,
    bio: null,
    shortBio: "Paints baskets and bowls in the morning light.",
    ...overrides,
  } as PublicArtistDetail;
}

afterEach(cleanup);

describe("ArtworkBuyColumn", () => {
  it("orders the eyebrow, the title with its year, the artist link and the meta line", () => {
    const vm = vmFor(detail());
    render(
      <ArtworkBuyColumn vm={vm}>
        <p>buy area</p>
      </ArtworkBuyColumn>,
    );
    expect(screen.getByText("Limited edition print")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Warm Basket, 2025");
    expect(screen.getByRole("link", { name: "Emmett King" }).getAttribute("href")).toBe(
      "/artists/emmett-king",
    );
    expect(screen.getByText(/Giclée print on Cotton rag · 60 × 45 cm/)).toBeTruthy();
    expect(screen.getByText("buy area")).toBeTruthy();
  });

  it("changes the wording, not the layout, for an open edition and an artist's proof", () => {
    const open = vmFor(
      detail({
        run: { kind: "open" },
        facts: {
          numbering: "none",
          signature: { kind: "unsigned" },
          certificate: { kind: "none" },
        },
        proofsKept: null,
        otherRuns: [],
      }),
    );
    const { rerender } = render(<ArtworkBuyColumn vm={open}>{null}</ArtworkBuyColumn>);
    expect(screen.getByText("Open edition print")).toBeTruthy();
    const proof = vmFor(
      detail({
        run: { kind: "proof", proofType: "ap", size: 3 },
        facts: handSigned,
        proofsKept: null,
        otherRuns: [],
      }),
    );
    rerender(<ArtworkBuyColumn vm={proof}>{null}</ArtworkBuyColumn>);
    expect(screen.getByText("Artist's proof")).toBeTruthy();
  });
});

describe("ArtworkEditionFacts", () => {
  it("shows the label-value rows and what a limited edition is, from the shared contract", () => {
    const facts = vmFor(detail()).facts;
    if (!facts) throw new Error("expected facts");
    render(<ArtworkEditionFacts facts={facts} />);
    const section = screen.getByRole("region", { name: "About this edition" });
    for (const label of ["Edition", "Signature", "Number", "Certificate"]) {
      expect(within(section).getByText(label)).toBeTruthy();
    }
    expect(within(section).getByText("Limited edition of 24")).toBeTruthy();
    expect(
      within(section).getByText(
        "Numbered by hand on the print. Your number appears in your order once payment is confirmed.",
      ),
    ).toBeTruthy();
    expect(within(section).getByText(/A limited edition is a fixed number of prints/)).toBeTruthy();
    expect(within(section).queryByText("Proofs")).toBeNull();
  });

  it("shows the proofs row when proofs were kept", () => {
    const facts = vmFor(
      detail({
        run: { kind: "limited", size: 24 },
        facts: handSigned,
        proofsKept: { ap: 2, pp: 0, hc: 0 },
        otherRuns: [],
      }),
    ).facts;
    if (!facts) throw new Error("expected facts");
    render(<ArtworkEditionFacts facts={facts} />);
    expect(screen.getByText("Proofs")).toBeTruthy();
    expect(screen.getByText(/The artist also kept 2 artist's proofs/)).toBeTruthy();
  });

  it("lists other runs, keeping the link for a sold-out one", () => {
    const facts = vmFor(
      detail({
        run: { kind: "limited", size: 24 },
        facts: handSigned,
        proofsKept: null,
        otherRuns: [
          {
            slug: "ap",
            run: { kind: "proof", proofType: "ap", size: 3 },
            facts: handSigned,
            printPricePence: 65_000,
            availability: "available",
          },
          {
            slug: "open",
            run: { kind: "open" },
            facts: {
              numbering: "none",
              signature: { kind: "unsigned" },
              certificate: { kind: "none" },
            },
            printPricePence: 9_000,
            availability: "sold_out",
          },
        ],
      }),
    ).facts;
    if (!facts) throw new Error("expected facts");
    render(<ArtworkEditionFacts facts={facts} />);
    expect(screen.getByText("Also available")).toBeTruthy();
    const ap = screen.getByRole("link", { name: "As an artist's proof" });
    expect(ap.getAttribute("href")).toBe("/artworks/ap");
    expect(ap.parentElement?.textContent).toBe("As an artist's proof · £650");
    const open = screen.getByRole("link", { name: "Unsigned, open edition" });
    expect(open.getAttribute("href")).toBe("/artworks/open");
    expect(open.parentElement?.textContent).toBe("Unsigned, open edition · Sold out");
  });

  it("links the original on lax.art, and leaves the link out without a source original", () => {
    const withOriginal = vmFor(detail()).facts;
    if (!withOriginal) throw new Error("expected facts");
    const { unmount } = render(<ArtworkEditionFacts facts={withOriginal} />);
    expect(
      screen.getByRole("link", { name: /See the original at lax.art/ }).getAttribute("href"),
    ).toBe("https://www.thelax.art/artworks/warm-basket-original");
    unmount();
    const without = vmFor(detail(null, { sourceOriginalSlug: null })).facts;
    if (!without) throw new Error("expected facts");
    render(<ArtworkEditionFacts facts={without} />);
    expect(screen.queryByRole("link", { name: /See the original/ })).toBeNull();
  });
});

describe("ArtworkAboutWork", () => {
  it("shows the paragraph and the rows for the medium, paper and sheet size", () => {
    render(<ArtworkAboutWork about={vmFor(detail()).about} />);
    expect(screen.getByRole("heading", { name: "About the work and the print" })).toBeTruthy();
    expect(screen.getByText("A still life of a basket.")).toBeTruthy();
    for (const label of ["Medium", "Paper", "Sheet size"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("76 × 56 cm")).toBeTruthy();
  });

  it("renders nothing when there is nothing to say", () => {
    const about = vmFor(
      detail(null, { description: null, medium: null, printPaper: null, printSize: null }),
    ).about;
    const { container } = render(<ArtworkAboutWork about={about} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ArtworkArtistSummary", () => {
  it("shows the portrait, the name linking to Editions by, the bio and both actions", () => {
    const vm = vmFor(detail(), {
      artistDetail: artist({ portraitUrl: "/emmett.webp" }),
      artistEditionCount: 5,
    });
    const { container } = render(<ArtworkArtistSummary artist={vm.artist} />);
    expect(screen.getByRole("region", { name: "About the artist" })).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toContain("emmett");
    expect(screen.getByRole("link", { name: "Emmett King" }).getAttribute("href")).toBe(
      "/artists/emmett-king",
    );
    expect(screen.getByText("Paints baskets and bowls in the morning light.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Editions by Emmett King (5)" }).getAttribute("href"),
    ).toBe("/artists/emmett-king");
    expect(screen.getByRole("link", { name: /Profile on lax.art/ }).getAttribute("href")).toBe(
      "https://www.thelax.art/artists/emmett-king",
    );
    expect(screen.queryByText(/Follow/)).toBeNull();
  });

  it("falls back to initials without a portrait, and to name and actions without a bio", () => {
    const vm = vmFor(detail(), { artistDetail: artist({ shortBio: null }) });
    const { container } = render(<ArtworkArtistSummary artist={vm.artist} />);
    expect(screen.getByText("EK")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/Paints baskets/)).toBeNull();
    expect(screen.getByRole("link", { name: /Editions by Emmett King/ })).toBeTruthy();
  });

  it("hides the lax.art profile when lax.art is not linked, and lets a long name take two lines", () => {
    const vm = vmFor(
      detail(null, { artistName: "Maximilian Alexander Featherstonehaugh-Cholmondeley" }),
      { artBaseUrl: null },
    );
    render(<ArtworkArtistSummary artist={vm.artist} />);
    expect(screen.queryByRole("link", { name: /Profile on lax.art/ })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Maximilian Alexander Featherstonehaugh-Cholmondeley" })
        .className,
    ).toContain("line-clamp-2");
  });
});

describe("ArtworkMoreBy", () => {
  const others = (n: number, state: "available" | "sold_out" = "available") =>
    Array.from({ length: n }, (_, i) => summary(`other-${i}`, state));

  function renderMore(n: number, total?: number) {
    const moreBy = vmFor(detail(), { artistEditions: others(n), artistEditionCount: total }).moreBy;
    return moreBy ? render(<ArtworkMoreBy moreBy={moreBy} />) : null;
  }

  it("is hidden with no other edition", () => {
    expect(renderMore(0)).toBeNull();
  });

  it("pairs one other edition with a text tile", () => {
    renderMore(1);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "1 more edition by Emmett King" }).getAttribute("href"),
    ).toBe("/artists/emmett-king");
  });

  it("shows a row of three with no further link", () => {
    renderMore(3);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /All \d+ editions/ })).toBeNull();
  });

  it("shows a row of four, then 'All N editions by', for five or more", () => {
    renderMore(5, 9);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: "All 9 editions by Emmett King" }).getAttribute("href"),
    ).toBe("/artists/emmett-king");
  });
});
