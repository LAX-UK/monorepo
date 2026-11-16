import { AuthLayout } from "@/components/auth/auth-layout";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/lax-logo", () => ({
  LaxLogo: () => <div data-testid="auth-logo" />,
}));

describe("AuthLayout", () => {
  it("draws the sign-in content as the server sent it: never hidden on hydration, no entrance", () => {
    const { container } = render(
      <AuthLayout title="Sign in" description="Test description">
        <p>Form content</p>
      </AuthLayout>,
    );

    // A reveal wrapper arms on hydration (hiding what the server drew) and fades it back: the blink.
    expect(
      container.querySelector(".reveal, [data-reveal-init], [data-reveal-trigger]"),
    ).toBeNull();
    for (let el = screen.getByText("Form content").parentElement; el; el = el.parentElement) {
      expect(el.className).not.toMatch(/(^|\s)(reveal|fade-up|animate-[\w-]+|opacity-0)(\s|$)/);
    }
  });

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

  it("shows the title as written, without an uppercase transform", () => {
    render(
      <AuthLayout title="Sign in" description="Test description">
        <p>Form content</p>
      </AuthLayout>,
    );
    expect(screen.getByRole("heading", { name: "Sign in" })).not.toHaveClass("uppercase");
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
