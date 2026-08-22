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

describe("SignUpForm footer", () => {
  it("shows the sign-in link", () => {
    vi.mocked(useSignUpController).mockReturnValue({
      form: {
        control: {},
        formState: { errors: {} },
        handleSubmit: (fn: () => void) => fn,
      },
      onSubmit: vi.fn(),
      loading: false,
      turnstileSiteKey: undefined,
      turnstileReady: true,
      onTurnstileToken: vi.fn(),
      onTurnstileExpire: vi.fn(),
    } as never);

    render(<SignUpForm />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });
});
