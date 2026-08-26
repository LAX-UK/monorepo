import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuyerOnboardingRouteError } from "./buyer-onboarding-route-error";

const reportRouteError = vi.fn();

vi.mock("@/lib/observability/use-report-route-error", () => ({
  useReportRouteError: (error: Error | undefined) => reportRouteError(error),
}));

describe("BuyerOnboardingRouteError", () => {
  it("offers retry and a safe dashboard exit", () => {
    const reset = vi.fn();
    render(
      <BuyerOnboardingRouteError
        title="Couldn’t load your interests"
        detail="Try again in a moment."
        reset={reset}
      />,
    );

    expect(screen.getByRole("heading", { name: /couldn’t load your interests/i })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /return to dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("reports the route error for observability", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc" });
    render(
      <BuyerOnboardingRouteError
        title="Couldn’t load your interests"
        detail="Try again in a moment."
        reset={vi.fn()}
        error={error}
      />,
    );
    expect(reportRouteError).toHaveBeenCalledWith(error);
  });
});
