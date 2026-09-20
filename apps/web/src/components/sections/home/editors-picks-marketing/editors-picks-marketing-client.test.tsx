import { EditorsPicksMarketingClient } from "@/components/sections/home/editors-picks-marketing/editors-picks-marketing-client";
/** @vitest-environment jsdom */
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/sections/home/editors-picks-marketing/editors-pick-marketing-card", () => ({
  EditorsPickMarketingCard: ({ lot }: { lot: { title: string; href: string } }) => (
    <a href={lot.href}>{lot.title}</a>
  ),
}));

const lot = (id: string, title: string): EditorsPickLotCardVM => ({
  id,
  href: `/lots/${id}`,
  title,
  artistName: "Artist",
  imageUrl: null,
  imageAlt: "",
  estimateLabel: "Estimate",
  estimateValue: "£1,000",
});

describe("EditorsPicksMarketingClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function ResizeObserverMock(this: ResizeObserver) {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        this.unobserve = vi.fn();
      }),
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("uses the shared labelled horizontal rail and keeps lot links navigable", () => {
    render(
      <EditorsPicksMarketingClient
        lots={[lot("a", "First pick"), lot("b", "Second pick")]}
        isAuthenticated={false}
        watchedLotIds={[]}
      />,
    );

    expect(screen.getByRole("list", { name: "Editor's picks" })).toHaveAttribute(
      "id",
      "home-editors-picks-rail",
    );
    expect(screen.getByRole("link", { name: "First pick" })).toHaveAttribute("href", "/lots/a");
    expect(screen.getByRole("link", { name: "Second pick" })).toHaveAttribute("href", "/lots/b");
  });
});
