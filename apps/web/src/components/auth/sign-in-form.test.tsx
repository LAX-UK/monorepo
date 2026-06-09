import { SignInForm } from "@/components/auth/sign-in-form";
import { fireEvent, render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWatch = vi.fn(() => "user@example.com");
const goToCredentials = vi.fn();
const changeEmail = vi.fn();

let mockStep: "email" | "credentials" = "email";
let mockEmailFirst = true;
let mockLinkSent = false;

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
    emailFirst: mockEmailFirst,
    step: mockStep,
    goToCredentials,
    changeEmail,
    requestMagicLink: vi.fn(),
    resendMagicLink: vi.fn(),
    linkSent: mockLinkSent,
    linkCooldown: 0,
    magicLinkLoading: false,
    magicLinkError: null,
    magicLinkTurnstileReady: true,
    onMagicLinkTurnstileToken: vi.fn(),
    onMagicLinkTurnstileExpire: vi.fn(),
  }),
}));

vi.mock("@/components/auth/social-sign-in-buttons", () => ({
  SocialSignInButtons: () => null,
}));

vi.mock("@/components/auth/primitives/rhf-input", () => ({
  RHFInput: () => <input aria-label="Email Address" />,
}));

vi.mock("@/components/auth/primitives/password-field", () => ({
  RHFPasswordField: () => <input aria-label="Password" autoComplete="current-password" />,
}));

describe("SignInForm", () => {
  beforeEach(() => {
    mockStep = "email";
    mockEmailFirst = true;
    mockLinkSent = false;
    goToCredentials.mockClear();
    changeEmail.mockClear();
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("next=%2Fdashboard") as never);
  });

  it("shows email step first in email-first mode", () => {
    render(<SignInForm />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("credentials step renders password, magic-link option, and forgot-password link", () => {
    mockStep = "credentials";
    render(<SignInForm />);

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /email me a sign-in link instead/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password?next=%2Fdashboard&email=user%40example.com",
    );
  });

  it("forgot password link carries next and email query params (legacy single-step)", () => {
    mockEmailFirst = false;
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

  it("starts on credentials when prefill email is present", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("next=%2Fdashboard&email=user%40example.com") as never,
    );
    mockStep = "credentials";
    render(<SignInForm />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("calls goToCredentials when Continue is clicked on email step", () => {
    render(<SignInForm />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(goToCredentials).toHaveBeenCalled();
  });
});
