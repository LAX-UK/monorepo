import { TaskRouteHeader } from "@/components/task/task-route-header";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("TaskRouteHeader", () => {
  it("hides gallery navigation throughout onboarding", () => {
    vi.mocked(usePathname).mockReturnValue("/onboarding/interests");
    const { container } = render(<TaskRouteHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps gallery navigation on other task routes", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    render(<TaskRouteHeader />);
    expect(screen.getByRole("link", { name: "Back to gallery" })).toBeVisible();
  });
});
