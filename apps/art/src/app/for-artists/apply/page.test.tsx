import ArtistApplyPage from "@/app/for-artists/apply/page";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/art-services.server", () => ({
  artServices: { viewer: { load: async () => ({ kind: "guest" }) } },
}));
vi.mock("@/lib/artist-application/artist-application.services.server", () => ({
  artistApplicationGateway: { readState: async () => ({ kind: "signed_out" }) },
}));
vi.mock("@/components/artist-application/artist-application-form.client", () => ({
  ArtistApplicationForm: () => null,
}));

describe("for-artists/apply, signed out", () => {
  it("keeps the page's one h1 and shows the sign-in state under it as an h2", async () => {
    const html = renderToStaticMarkup(await ArtistApplyPage({ searchParams: Promise.resolve({}) }));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Apply to join<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Sign in to apply<\/h2>/);
    expect(html).toContain('data-layout="page"');
  });
});
