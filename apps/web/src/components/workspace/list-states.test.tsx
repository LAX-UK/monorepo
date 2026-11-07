import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListSkeleton } from "./list-states";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ListSkeleton", () => {
  it("renders the page's h1 while it loads when given a title", () => {
    render(<ListSkeleton label="Loading bids" title="Bids" />);
    expect(screen.getByRole("heading", { level: 1, name: "Bids" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading bids" })).toBeTruthy();
  });

  it("adds no heading when it sits inside a page that has its own", () => {
    render(<ListSkeleton label="Loading" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });
});
