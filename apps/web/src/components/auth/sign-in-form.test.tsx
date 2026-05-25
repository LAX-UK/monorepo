import { SignInForm } from "@/components/auth/sign-in-form";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockWatch = vi.fn(() => "user@example.com");

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=%2Fdashboard"),
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
  it("forgot password link carries next and email query params", () => {
    render(<SignInForm />);

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password?next=%2Fdashboard&email=user%40example.com",
    );
  });
});
