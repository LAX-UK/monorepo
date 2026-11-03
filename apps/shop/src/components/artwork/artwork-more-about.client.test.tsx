/** @vitest-environment jsdom */
import { ArtworkMoreAbout } from "@/components/artwork/artwork-more-about.client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function mockWidth(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("ArtworkMoreAbout", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts closed on a phone and keeps the summary", () => {
    mockWidth(false);
    const { container } = render(<ArtworkMoreAbout>Body</ArtworkMoreAbout>);
    expect(screen.getByText("More about this edition")).toBeTruthy();
    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("is open from tablet width", () => {
    mockWidth(true);
    const { container } = render(<ArtworkMoreAbout>Body</ArtworkMoreAbout>);
    expect(container.querySelector("details")?.open).toBe(true);
  });
});
