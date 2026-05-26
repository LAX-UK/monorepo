import { AuthRouteLoading } from "@/components/auth/auth-route-loading";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AuthRouteLoading", () => {
  it("renders a logo-sized skeleton above title placeholders", () => {
    render(<AuthRouteLoading />);

    expect(screen.getByTestId("auth-logo-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
