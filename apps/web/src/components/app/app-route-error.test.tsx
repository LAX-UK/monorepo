import { AppRouteError } from "@/components/app/app-route-error";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/use-report-route-error", () => ({
  useReportRouteError: vi.fn(),
}));

describe("AppRouteError", () => {
  it("renders alert region with retry and home actions", () => {
    render(
      <AppRouteError
        error={new Error("boom")}
        reset={() => {}}
        homeHref="/dashboard"
        homeLabel="Open overview"
      />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open overview" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(document.querySelector("svg[aria-hidden]")).toBeTruthy();
  });

  it("applies fixed site header offset when siteHeaderOffset is set", () => {
    const { container } = render(
      <AppRouteError error={new Error("boom")} reset={() => {}} siteHeaderOffset />,
    );

    const section = container.querySelector("section");
    expect(section?.className).toContain("pt-[var(--header-height)]");
    expect(section?.className).toContain("min-h-[calc(100dvh-var(--header-height))]");
  });
});
