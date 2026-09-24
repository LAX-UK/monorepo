import { SignInCredentialsStep } from "@/components/auth/sign-in-credentials-step";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let widgetCount = 0;

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => {
    widgetCount += 1;
    return <div data-testid="turnstile-widget" />;
  },
}));

vi.mock("@/components/auth/social-sign-in-buttons", () => ({
  SocialSignInButtons: () => null,
}));

vi.mock("@/components/auth/primitives/password-field", () => ({
  RHFPasswordField: () => <input aria-label="Password" />,
}));

const baseProps = {
  control: {} as never,
  email: "user@example.com",
  next: "/dashboard",
  forgotPasswordHref: "/forgot-password",
  loading: false,
  signInSubmitDisabled: false,
  showCaptcha: true,
  turnstileSiteKey: "site-key",
  onTurnstileReady: vi.fn(),
  onTurnstileToken: vi.fn(),
  onTurnstileExpire: vi.fn(),
  onTurnstileError: vi.fn(),
  onChangeEmail: vi.fn(),
  linkSent: false,
  linkCooldown: 0,
  magicLinkLoading: false,
  magicLinkError: null,
  magicLinkTurnstileReady: false,
  onRequestMagicLink: vi.fn(),
  onResendMagicLink: vi.fn(),
};

describe("SignInCredentialsStep", () => {
  it("renders a single Turnstile widget for password and magic-link flows", () => {
    widgetCount = 0;
    render(<SignInCredentialsStep {...baseProps} />);
    expect(screen.getAllByTestId("turnstile-widget")).toHaveLength(1);
    expect(widgetCount).toBe(1);
  });
});
