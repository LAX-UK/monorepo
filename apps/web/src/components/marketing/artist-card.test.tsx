import { ArtistCardGrid } from "@/components/marketing/artist-card";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("ArtistCardGrid", () => {
  it("positions portraitOverlay at the bottom-right of the portrait", () => {
    render(
      <ul>
        <ArtistCardGrid
          href="/artist/jane-doe/artist-1"
          aria-label="View Jane Doe"
          portraitOverlay={<button type="button">Heart</button>}
          portrait={<span data-testid="portrait">Portrait</span>}
          badges={null}
          title={<h2>Jane Doe</h2>}
          meta={null}
          footer={<span>Lots</span>}
        />
      </ul>,
    );

    const heart = screen.getByRole("button", { name: "Heart" });
    const overlay = heart.parentElement;
    expect(overlay).toHaveClass("bottom-3", "right-3", "pointer-events-auto");
    expect(overlay?.parentElement).toContainElement(screen.getByTestId("portrait"));
  });
});
