import TaskLayout from "@/app/(task)/layout";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/login";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

afterEach(() => {
  pathname = "/login";
  cleanup();
});

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

  it("omits task header chrome throughout onboarding", () => {
    pathname = "/onboarding/interests";

    render(
      <TaskLayout>
        <p>Onboarding content</p>
      </TaskLayout>,
    );

    expect(screen.queryByRole("link", { name: "Back to gallery" })).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByText("Onboarding content")).toBeInTheDocument();
  });
});
