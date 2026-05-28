import TaskLayout from "@/app/(task)/layout";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
}));

describe("TaskLayout", () => {
  it("renders back to gallery link and omits legacy header chrome", () => {
    render(
      <TaskLayout>
        <p>Page content</p>
      </TaskLayout>,
    );

    expect(screen.getByRole("link", { name: "Back to gallery" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Browse catalogue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
