/** @vitest-environment jsdom */
import { PrintCard } from "@/components/home/cards/print-card";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("PrintCard", () => {
  it("renders linked cards as anchors", () => {
    render(
      <PrintCard
        card={{
          id: "print-1",
          image: "/shop/home/artwork-warm-basket.webp",
          imageAlt: "Innocence",
          title: "Innocence",
          artist: "Ria Arante",
          medium: "Oil",
          href: "/artworks/demo",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Innocence by Ria Arante" }).getAttribute("href")).toBe(
      "/artworks/demo",
    );
  });

  it("renders static cards without links", () => {
    render(
      <PrintCard
        card={{
          id: "print-2",
          image: "/shop/home/artwork-warm-basket.webp",
          imageAlt: "Static",
          title: "Static",
          artist: "Artist",
          medium: "Medium",
        }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Static")).toBeTruthy();
  });
});
