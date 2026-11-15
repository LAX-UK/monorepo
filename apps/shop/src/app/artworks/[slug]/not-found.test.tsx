/** @vitest-environment jsdom */
import ArtworkNotFound from "@/app/artworks/[slug]/not-found";
import { artworkSummary } from "@/test/artwork-summary.fixture";
import { cleanup, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not vi.fn: the spy's own bookkeeping would re-throw a rejected promise.
const calls: unknown[] = [];
let outcome: () => Promise<unknown> = async () => ({ items: [] });
vi.mock("@/lib/shop-api.server", () => ({
  fetchPublicArtworks: (arg: unknown) => {
    calls.push(arg);
    return outcome();
  },
}));
vi.mock("next/image", () => ({
  default: ({
    fill: _f,
    priority: _p,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // biome-ignore lint/a11y/useAltText: alt is passed through
    <img {...props} />
  ),
}));

describe("artwork not-found route", () => {
  beforeEach(() => {
    calls.length = 0;
  });
  afterEach(cleanup);

  it("says the edition cannot be found and offers the newest editions", async () => {
    outcome = async () => ({ items: [artworkSummary({ title: "Harbour light" })] });
    render(await ArtworkNotFound());
    expect(
      screen.getByRole("heading", { level: 1, name: "We can't find this edition" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Harbour light" })).toBeTruthy();
    expect(screen.getByText(/Here are some newer editions/)).toBeTruthy();
    expect(calls).toEqual([{ limit: 4, sort: "newest" }]);
  });

  it("still renders, without the editions block, when the fetch fails", async () => {
    outcome = () => Promise.reject(new Error("unavailable"));
    render(await ArtworkNotFound());
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Other editions" })).toBeNull();
    expect(screen.queryByText(/Here are some newer editions/)).toBeNull();
    expect(screen.getByRole("link", { name: "New editions" })).toBeTruthy();
  });
});
