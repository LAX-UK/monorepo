import { TaskRouteHeaderTitle } from "@/components/task/task-route-header-title";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("TaskRouteHeaderTitle", () => {
  it("shows forgot-password label", () => {
    vi.mocked(usePathname).mockReturnValue("/forgot-password");
    render(<TaskRouteHeaderTitle />);
    expect(screen.getByText("Forgot password")).toBeInTheDocument();
  });

  it("shows onboarding label for organisation wizard", () => {
    vi.mocked(usePathname).mockReturnValue("/onboarding/organisation/step/details");
    render(<TaskRouteHeaderTitle />);
    expect(screen.getByText("Organisation onboarding")).toBeInTheDocument();
  });

  it("renders nothing on unknown routes", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { container } = render(<TaskRouteHeaderTitle />);
    expect(container).toBeEmptyDOMElement();
  });
});
