import { MagicLinkRequestForm } from "@/components/auth/magic-link-request-form";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockTurnstileReady = false;

vi.mock("@/lib/auth/hooks/use-magic-link-request-controller", () => ({
  useMagicLinkRequestController: () => ({
    form: {
      control: {},
      formState: { errors: {} },
    },
    onSubmit: vi.fn(),
    loading: false,
    bannerError: null,
    submittedEmail: null,
    resend: vi.fn(),
    cooldown: 0,
    turnstileSiteKey: "site-key",
    onTurnstileReady: vi.fn(),
    onTurnstileToken: vi.fn(),
    onTurnstileExpire: vi.fn(),
    onTurnstileError: vi.fn(),
    turnstileReady: mockTurnstileReady,
  }),
}));

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => <div data-testid="turnstile-widget" />,
}));

vi.mock("@/components/auth/primitives/rhf-input", () => ({
  RHFInput: () => <input aria-label="Email Address" />,
}));

describe("MagicLinkRequestForm", () => {
  beforeEach(() => {
    mockTurnstileReady = false;
  });

  it("keeps submit disabled until Turnstile provides a token", () => {
    const { rerender } = render(<MagicLinkRequestForm />);
    expect(screen.getByRole("button", { name: "Send activation link" })).toBeDisabled();

    mockTurnstileReady = true;
    rerender(<MagicLinkRequestForm />);
    expect(screen.getByRole("button", { name: "Send activation link" })).toBeEnabled();
  });
});
