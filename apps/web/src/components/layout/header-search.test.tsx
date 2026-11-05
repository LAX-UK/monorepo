import { HeaderSearchTrigger } from "@/components/layout/header-search";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const openPalette = vi.fn();
vi.mock("@/components/layout/command-palette-events", () => ({
  openCommandPalette: () => openPalette(),
}));

describe("HeaderSearchTrigger", () => {
  it("is a search field from 1280px with the placeholder 'Search lots, artists and sales'", () => {
    render(<HeaderSearchTrigger layout="pill" fullBarFrom="xl" />);
    const field = screen.getByRole("button", { name: "Search" });
    expect(field).toHaveTextContent("Search lots, artists and sales");
    expect(field.className).toContain("hidden xl:flex");
  });

  it("is an icon below 1280px", () => {
    render(<HeaderSearchTrigger layout="icon" fullBarFrom="xl" />);
    const icon = screen.getByRole("button", { name: "Open search" });
    expect(icon.className).toContain("xl:hidden");
  });

  it("opens the existing search from either form", () => {
    openPalette.mockReset();
    render(<HeaderSearchTrigger layout="both" fullBarFrom="xl" />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));
    expect(openPalette).toHaveBeenCalledTimes(2);
  });
});
