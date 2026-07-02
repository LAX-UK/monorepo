import { SignUpForm } from "@/components/auth/sign-up-form";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/hooks/use-sign-up-controller", () => ({
  useSignUpController: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/auth/sign-up-fields", () => ({
  SignUpFields: () => null,
}));

vi.mock("@/components/auth/sign-up-legal-consent", () => ({
  SignUpLegalConsent: () => null,
}));

vi.mock("@/components/auth/sell-auth-intent-banner", () => ({
  SellAuthIntentBanner: () => null,
}));

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => null,
}));

vi.mock("@/components/auth/social-sign-in-buttons", () => ({
  SocialSignInButtons: () => null,
}));

vi.mock("@/lib/legal-entity/pending-invite-cookie.actions", () => ({
  rememberPendingEntityInviteAction: vi.fn(),
}));

describe("SignUpForm email_already_registered banner", () => {
  it("shows sign in and reset password links when registration email is already registered", () => {
    vi.mocked(useSignUpController).mockReturnValue({
      form: {
        control: {},
        formState: { errors: {} },
        handleSubmit: (fn: () => void) => fn,
      },
      onSubmit: vi.fn(),
      loading: false,
      bannerError:
        "This email is already registered. Sign in or reset your password to access your account.",
      lastErrorCode: "email_already_registered",
      turnstileSiteKey: undefined,
      turnstileReady: true,
      onTurnstileToken: vi.fn(),
      onTurnstileExpire: vi.fn(),
    } as never);

    render(<SignUpForm />);

    expect(screen.getByRole("link", { name: /sign in to your account/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: /reset your password/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});
