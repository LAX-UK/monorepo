/** @vitest-environment jsdom */
import ArtistApplyPage from "@/app/for-artists/apply/page";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(cleanup);

  it("keeps the page's one h1 and shows the sign-in state under it as an h2", async () => {
    render(await ArtistApplyPage({ searchParams: Promise.resolve({}) }));
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.textContent).toContain("Apply to join");
    expect(screen.getByRole("heading", { level: 2, name: "Sign in to apply" })).toBeTruthy();
    expect(document.querySelector("[data-layout='page']")).not.toBeNull();
  });
});
