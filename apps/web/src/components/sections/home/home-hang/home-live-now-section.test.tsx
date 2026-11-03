import type { LiveNowVM } from "@/lib/hang/live-now";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeLiveNowSection } from "./home-live-now-section";

const viewers = vi.hoisted(() => ({ byId: {} as Record<string, string> }));
vi.mock("@/lib/marketing-cover/cover-viewer.client", () => ({
  fetchCoverViewer: async (id: string) => viewers.byId[id] ?? "anonymous",
}));

const hang = (id: string) => ({
  kind: "inSale" as const,
  title: "In this sale",
  summary: "3 lots",
  scaleNote: false,
  seeAll: { href: `/sales/${id}`, label: `See all lots of ${id}` },
  works: [],
});
const liveNow: LiveNowVM = {
  defaultSaleId: "a",
  allLive: { href: "/sales?tab=live", label: "All live sales" },
  tabs: ["a", "b", "c"].map((id) => ({
    saleId: id,
    title: `Sale ${id}`,
    closes: "Closes in 2 days",
    hang: hang(id),
  })),
};

afterEach(() => {
  cleanup();
  viewers.byId = {};
});

describe("HomeLiveNowSection", () => {
  it("opens a visitor on the lead sale and links to all live sales", () => {
    render(<HomeLiveNowSection liveNow={liveNow} signedIn={false} />);
    expect(screen.getByRole("tab", { name: "Sale a, closes in 2 days" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "All live sales" })[0]).toHaveAttribute(
      "href",
      "/sales?tab=live",
    );
  });

  it("opens a signed-in bidder on the sale they are registered in", async () => {
    viewers.byId = { c: "approved" };
    render(<HomeLiveNowSection liveNow={liveNow} signedIn />);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Sale c/ })).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("moves between tabs with the arrow keys and keeps one tab stop", () => {
    render(<HomeLiveNowSection liveNow={liveNow} signedIn={false} />);
    const first = screen.getByRole("tab", { name: /Sale a/ });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: /Sale b/ });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveFocus();
    expect(first).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(second, { key: "End" });
    expect(screen.getByRole("tab", { name: /Sale c/ })).toHaveAttribute("aria-selected", "true");
  });
});
