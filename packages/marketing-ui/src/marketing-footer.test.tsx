import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingFooter } from "./marketing-footer.js";

const columns = [
  { id: "shop", title: "Shop", links: [{ label: "Editions", href: "/artworks" }] },
  {
    id: "legal",
    title: "Legal",
    links: [
      { label: "Legal and policies", href: "/legal" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

function renderFooter() {
  return render(<MarketingFooter logo={<span>logo</span>} columns={columns} copyright="© LAX" />);
}

function stubViewport(phone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        matches: phone && query.includes("max-width"),
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MarketingFooter columns", () => {
  it("shows every link, with plain headings, on wider screens", () => {
    stubViewport(false);
    renderFooter();
    expect(screen.getByRole("link", { name: "Terms" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Legal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Legal" })).not.toBeInTheDocument();
  });

  it("folds each column on a phone and opens it from its heading", () => {
    stubViewport(true);
    renderFooter();
    const toggle = screen.getByRole("button", { name: "Legal" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Terms" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Terms" })).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps columns independent of each other", () => {
    stubViewport(true);
    renderFooter();
    fireEvent.click(screen.getByRole("button", { name: "Shop" }));
    expect(screen.getByRole("link", { name: "Editions" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Terms" })).not.toBeInTheDocument();
  });
});
