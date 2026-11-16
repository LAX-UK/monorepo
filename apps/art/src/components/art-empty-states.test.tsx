import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("ArtStatusState is the shared EmptyState", () => {
  it("renders the empty frame on the paper plate in the product accent, with its copy", () => {
    const out = html(<ArtStatusState variant="empty" title="No works" description="Check back." />);
    expect(out).toContain('data-empty-state="frame"');
    expect(out).toContain("bg-lax-paper");
    expect(out).toContain("text-lax-plate-ink");
    expect(out).toContain("No works");
    expect(out).toContain("Check back.");
    expect(out).not.toContain("marketing-status-state__title");
  });

  it("is never boxed: the open layout is the shared inline state", () => {
    const out = html(<ArtStatusState variant="empty" title="t" description="d" />);
    expect(out).toContain('data-layout="inline"');
    expect(out).not.toContain("border");
  });

  it("is the page layout with the page's h1 on a full-route empty", () => {
    const out = html(<ArtStatusState variant="empty" layout="page" title="Gone" description="d" />);
    expect(out).toContain('data-layout="page"');
    expect(out).toMatch(/<h1[^>]*>Gone<\/h1>/);
  });

  it("keeps an h2 in the page layout when the page already owns its h1", () => {
    const out = html(
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h2"
        title="Sign in to apply"
        description="d"
      />,
    );
    expect(out).toContain('data-layout="page"');
    expect(out).toMatch(/<h2[^>]*>Sign in to apply<\/h2>/);
    expect(out).not.toContain("<h1");
  });

  it("keeps the old motif names", () => {
    expect(
      html(<ArtStatusState variant="empty" icon="search-remove" title="t" description="d" />),
    ).toContain('data-empty-state="search"');
  });

  it("errors show the askew drawing and are announced politely", () => {
    const out = html(<ArtStatusState variant="error" title="Oops" description="d" />);
    expect(out).toContain('data-empty-state="askew"');
    expect(out).toContain('role="status"');
  });

  it("renders its action link", () => {
    const out = html(
      <ArtStatusState
        variant="empty"
        title="t"
        description="d"
        actions={<ArtStatusStateLink href="/artworks">Browse</ArtStatusStateLink>}
      />,
    );
    expect(out).toContain('href="/artworks"');
  });
});

describe("lax.art empty states", () => {
  it("account list empty keeps its copy and action", () => {
    const out = html(
      <ArtAccountListStateView
        state={{ kind: "empty" } as never}
        empty={{
          title: "No saved works",
          description: "Works you save appear here.",
          action: { href: "/artworks", label: "Browse works" },
        }}
        failedDescription="Failed."
      >
        {() => null}
      </ArtAccountListStateView>,
    );
    expect(out).toContain("No saved works");
    expect(out).toContain("Works you save appear here.");
    expect(out).toContain("Browse works");
    expect(out).toContain('data-empty-state="frame"');
  });
});

describe("the plate ink", () => {
  it("is the product accent, so the drawing is in the accent in both themes", () => {
    const css = readFileSync(join(process.cwd(), "src/app/base.css"), "utf8");
    expect(css).toMatch(/--lax-plate-ink: var\(--color-product-accent\);/);
  });
});
