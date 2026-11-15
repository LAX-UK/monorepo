/** @vitest-environment jsdom */
import { ArtworkUnlistedState } from "@/components/artwork/artwork-unlisted-state";
import { artworkSummary } from "@/test/artwork-summary.fixture";
import { cleanup, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("ArtworkUnlistedState", () => {
  afterEach(cleanup);

  it("says the edition is no longer listed, offers other editions and a New editions link", () => {
    render(<ArtworkUnlistedState editions={[artworkSummary({ title: "Harbour light" })]} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "This edition is no longer listed" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "New editions" }).getAttribute("href")).toBe(
      "/artworks?sort=newest",
    );
    expect(screen.getByRole("heading", { name: "Other editions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Harbour light" })).toBeTruthy();
  });

  it("still says so, without the editions block, when none could be loaded", () => {
    render(<ArtworkUnlistedState editions={[]} />);
    expect(screen.getByText("This edition is no longer listed")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Other editions" })).toBeNull();
  });
});
