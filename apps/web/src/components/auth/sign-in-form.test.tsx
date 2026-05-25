import { SignInForm } from "@/components/auth/sign-in-form";
import { render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWatch = vi.fn(() => "user@example.com");

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams("next=%2Fdashboard")),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: null, pending: false }),
}));

vi.mock("@/lib/auth/hooks/use-sign-in-controller", () => ({
  useSignInController: () => ({
    form: {
      control: {},
      watch: mockWatch,
    },
    onSubmit: vi.fn((e: Event) => e.preventDefault()),
    loading: false,
    bannerError: null,
    showCaptcha: false,
    turnstileSiteKey: null,
    onTurnstileToken: vi.fn(),
    onTurnstileExpire: vi.fn(),
  }),
}));

vi.mock("@/components/auth/social-sign-in-buttons", () => ({
  SocialSignInButtons: () => null,
}));

vi.mock("@/components/auth/primitives/rhf-input", () => ({
  RHFInput: () => <input aria-label="Email Address" />,
}));

vi.mock("@/components/auth/primitives/password-field", () => ({
  RHFPasswordField: () => <input aria-label="Password" />,
}));

describe("SignInForm", () => {
  beforeEach(() => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("next=%2Fdashboard") as never);
  });

  it("forgot password link carries next and email query params", () => {
    render(<SignInForm />);

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password?next=%2Fdashboard&email=user%40example.com",
    );
  });

  it("shows verify-pending banner when verify_pending=1", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("verify_pending=1") as never);
    render(<SignInForm />);
    expect(
      screen.getByText(/please check your inbox to finish verifying your email/i),
    ).toBeInTheDocument();
  });
});
