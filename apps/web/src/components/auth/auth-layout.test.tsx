import { AuthLayout } from "@/components/auth/auth-layout";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/auth-content-reveal", () => ({
  AuthContentReveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/lax-logo", () => ({
  LaxLogo: () => <div data-testid="auth-logo" />,
}));

describe("AuthLayout", () => {
  it("standalone chrome renders logo and browse catalogue link", () => {
    render(
      <AuthLayout title="Sign in" description="Test description">
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(screen.getByTestId("auth-logo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse catalogue" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });

  it("task chrome renders centered logo without browse catalogue link", () => {
    render(
      <AuthLayout chrome="task" title="Sign in" description="Test description">
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(screen.getByTestId("auth-logo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse catalogue" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });

  it("task chrome wraps form in a surface section", () => {
    render(
      <AuthLayout chrome="task" title="Sign in" description="Test description">
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(
      screen.getByText("Form content").closest("[class*='border-border-hairline']"),
    ).toBeTruthy();
  });
});
