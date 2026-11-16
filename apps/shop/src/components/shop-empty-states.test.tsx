import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";
import { CatalogueEmpty, CatalogueNoMatch } from "@/components/catalogue/catalogue-states";
import { ShopCatalogueEmpty } from "@/components/catalogue/shop-catalogue-empty";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/release-alerts/shop-release-alerts-inline", () => ({
  ShopReleaseAlertsInline: () => <div data-testid="release-alerts" />,
}));

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("ShopStatusState is the shared EmptyState", () => {
  it("renders the empty frame on the paper plate in the product accent, with its copy", () => {
    const out = html(
      <ShopStatusState variant="empty" title="Nothing here yet" description="Come back soon." />,
    );
    expect(out).toContain('data-empty-state="frame"');
    expect(out).toContain("bg-lax-paper");
    expect(out).toContain("text-lax-plate");
    expect(out).toContain("Nothing here yet");
    expect(out).toContain("Come back soon.");
    expect(out).not.toContain("marketing-status-state__title");
  });

  it("keeps the old motif names: bag is the parcel, search-remove the magnifier", () => {
    expect(
      html(<ShopStatusState variant="empty" icon="bag" title="t" description="d" />),
    ).toContain('data-empty-state="parcel"');
    expect(
      html(<ShopStatusState variant="empty" icon="search-remove" title="t" description="d" />),
    ).toContain('data-empty-state="search"');
  });

  it("is the page layout with the page's h1 for page-level states", () => {
    const out = html(
      <ShopStatusState variant="empty" layout="page" titleAs="h1" title="Basket" description="d" />,
    );
    expect(out).toContain('data-layout="page"');
    expect(out).toMatch(/<h1[^>]*>Basket<\/h1>/);
  });

  it("keeps an h2 in the page layout when the page already owns its h1", () => {
    const out = html(
      <ShopStatusState
        variant="empty"
        layout="page"
        titleAs="h2"
        title="Your basket is empty"
        description="d"
      />,
    );
    expect(out).toContain('data-layout="page"');
    expect(out).toMatch(/<h2[^>]*>Your basket is empty<\/h2>/);
    expect(out).not.toContain("<h1");
  });

  it("is the page's h1 in the page layout when no level is given", () => {
    const out = html(
      <ShopStatusState variant="error" layout="page" title="Down" description="d" />,
    );
    expect(out).toMatch(/<h1[^>]*>Down<\/h1>/);
  });

  it("renders a quiet notice title as a paragraph by default", () => {
    const out = html(<ShopStatusState variant="empty" title="Quiet" description="d" />);
    expect(out).toMatch(/<p[^>]*>Quiet<\/p>/);
    expect(out).not.toContain("<h2");
  });

  it("does not announce an empty state, and announces when asked", () => {
    expect(html(<ShopStatusState variant="empty" title="t" description="d" />)).not.toContain(
      "role=",
    );
    expect(
      html(<ShopStatusState variant="empty" announcement="polite" title="t" description="d" />),
    ).toContain('role="status"');
  });

  it("draws a custom plate in place of the drawing", () => {
    const out = html(
      <ShopStatusState
        variant="empty"
        motifSlot={<span data-testid="custom-plate" />}
        title="t"
        description="d"
      />,
    );
    expect(out).toContain("custom-plate");
    expect(out).not.toContain("<svg");
  });

  it("renders its action link", () => {
    const out = html(
      <ShopStatusState
        variant="empty"
        title="t"
        description="d"
        actions={<ShopStatusStateLink href="/artworks">Browse editions</ShopStatusStateLink>}
      />,
    );
    expect(out).toContain('href="/artworks"');
    expect(out).toContain("Browse editions");
  });
});

describe("Shop empty states", () => {
  it("catalogue empty: the new-editions promise on the shared state, with the help route", () => {
    const out = html(<CatalogueEmpty artHref={null} />);
    expect(out).toContain("New editions are on their way");
    expect(out).toContain("data-empty-state");
    expect(out).toContain("Help and contact");
    expect(out).not.toContain("marketing-status-state__title");
  });

  it("catalogue empty: points to lax.art when it can", () => {
    expect(html(<CatalogueEmpty artHref="https://lax.art" />)).toContain(
      "See original works on lax.art",
    );
  });

  it("catalogue no match: filter copy and both ways out", () => {
    const out = html(
      <CatalogueNoMatch
        noMatch={{
          remove: { href: "/artworks?x=1", label: "Prints" },
          clearHref: "/artworks",
          availableNow: null,
        }}
      />,
    );
    expect(out).toContain("No editions match these filters");
    expect(out).toContain("Clear all filters");
    expect(out).toContain("Prints");
    expect(out).toContain('role="status"');
    expect(out).toContain("data-empty-state");
  });

  it("catalogue empty page copy and its action", () => {
    const out = html(
      <ShopCatalogueEmpty
        title="No artists yet"
        description="Artists appear here."
        actionHref="/artworks"
        actionLabel="Browse"
      />,
    );
    expect(out).toContain("No artists yet");
    expect(out).toContain("Browse");
    expect(out).toContain('data-empty-state="frame"');
  });

  it("home rail empty and error states", () => {
    expect(
      html(<ShopCatalogueState variant="empty" title="Nothing" description="Soon." />),
    ).toContain('data-empty-state="frame"');
    expect(
      html(
        <ShopCatalogueState variant="error" title="Down" description="Retry." showRetry={false} />,
      ),
    ).toContain('data-empty-state="askew"');
  });

  it("detail not-found state: eyebrow, h1 title and the ticket drawing", () => {
    const out = html(
      <ArtworkDetailState
        illustration="ticket"
        eyebrow="Not found"
        title="Artist not found"
        description="This artist may have moved."
      />,
    );
    expect(out).toContain("Not found");
    expect(out).toMatch(/<h1[^>]*>Artist not found<\/h1>/);
    expect(out).toContain('data-empty-state="ticket"');
    expect(out).toContain('data-layout="page"');
  });

  it("detail state: the eyebrow sits right above the h1 and the actions under the description", () => {
    const out = html(
      <ArtworkDetailState
        illustration="ticket"
        eyebrow="Not found"
        title="We can't find this edition"
        description="It may have been removed."
        actions={<a href="/artworks?sort=newest">New editions</a>}
      >
        <section data-testid="related" />
      </ArtworkDetailState>,
    );
    // Eyebrow, then h1, then description, then the action, all in the copy column.
    expect(out).toMatch(
      /<p[^>]*>Not found<\/p><h1[^>]*>We can&#x27;t find this edition<\/h1><p[^>]*>It may have been removed\.<\/p><div[^>]*><a href="\/artworks\?sort=newest">New editions<\/a><\/div>/,
    );
    // Related content comes after the whole state.
    expect(out.indexOf('data-testid="related"')).toBeGreaterThan(out.indexOf("New editions"));
  });
});

describe("the plate ink", () => {
  it("is the product accent, so the drawing is in the accent in both themes", () => {
    const css = readFileSync(join(process.cwd(), "src/app/base.css"), "utf8");
    expect(css).toMatch(/--lax-plate-ink: var\(--color-product-accent\);/);
  });
});
