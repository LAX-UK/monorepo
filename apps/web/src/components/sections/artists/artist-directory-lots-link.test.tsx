import { ArtistDirectoryLotsLink } from "@/components/sections/artists/artist-directory-lots-link";
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

describe("ArtistDirectoryLotsLink", () => {
  it("renders a #works link when count is positive", () => {
    render(<ArtistDirectoryLotsLink lotCount={3} href="/artist/jane-doe" artistName="Jane Doe" />);

    const link = screen.getByRole("link", { name: "Browse 3 lots by Jane Doe" });
    expect(link).toHaveAttribute("href", "/artist/jane-doe#works");
    expect(link).toHaveTextContent("3 lots");
  });

  it("uses singular copy for one lot", () => {
    render(<ArtistDirectoryLotsLink lotCount={1} href="/artist/jane-doe" artistName="Jane Doe" />);

    expect(screen.getByRole("link", { name: "Browse 1 lot by Jane Doe" })).toHaveTextContent(
      "1 lot",
    );
  });

  it("returns null when count is zero", () => {
    const { container } = render(
      <ArtistDirectoryLotsLink lotCount={0} href="/artist/jane-doe" artistName="Jane Doe" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("supports inline variant styling", () => {
    render(
      <ArtistDirectoryLotsLink
        lotCount={2}
        href="/artist/jane-doe"
        artistName="Jane Doe"
        variant="inline"
      />,
    );

    const link = screen.getByRole("link", { name: "Browse 2 lots by Jane Doe" });
    expect(link.className).toContain("text-[10px]");
  });
});
