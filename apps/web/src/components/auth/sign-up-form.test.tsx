import { SignUpForm } from "@/components/auth/sign-up-form";
import { fireEvent, render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

const goToDetails = vi.fn();
const backToPersona = vi.fn();

let mockStep: "persona" | "details" = "persona";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/lib/legal-entity/pending-invite-cookie.actions", () => ({
  rememberPendingEntityInviteAction: vi.fn(),
}));

vi.mock("@/components/auth/sell-auth-intent-banner", () => ({
  SellAuthIntentBanner: () => null,
}));

vi.mock("@/components/auth/sign-up-persona-step", () => ({
  SignUpPersonaStep: ({
    onContinue,
  }: {
    onContinue: () => void;
  }) => (
    <div>
      <p>Step 1 persona</p>
      <button type="button" onClick={onContinue}>
        Continue
      </button>
      <label>
        <input type="radio" name="persona" value="individual" defaultChecked />
        An individual
      </label>
      <label>
        <input type="radio" name="persona" value="organisation" />
        Representing a gallery, dealer, or estate
      </label>
    </div>
  ),
}));

vi.mock("@/components/auth/sign-up-details-step", () => ({
  SignUpDetailsStep: ({
    showPersonaSummary,
    onChangePersona,
    lockedEmail,
  }: {
    showPersonaSummary: boolean;
    onChangePersona: () => void;
    lockedEmail?: string;
  }) => (
    <div>
      <p>Step 2 details</p>
      {showPersonaSummary ? (
        <button type="button" onClick={onChangePersona}>
          Change
        </button>
      ) : null}
      {lockedEmail ? <p>Locked email: {lockedEmail}</p> : null}
      <label htmlFor="firstName">First Name</label>
      <input id="firstName" />
    </div>
  ),
}));

vi.mock("@/lib/auth/hooks/use-sign-up-controller", () => ({
  useSignUpController: () => ({
    form: {
      control: {},
      handleSubmit: (fn: () => void) => (e: Event) => {
        e.preventDefault();
        fn();
      },
    },
    onSubmit: vi.fn((e: Event) => e.preventDefault()),
    loading: false,
    step: mockStep,
    goToDetails,
    backToPersona,
    turnstileSiteKey: undefined,
    turnstileReady: true,
    onTurnstileToken: vi.fn(),
    onTurnstileExpire: vi.fn(),
  }),
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    mockStep = "persona";
    goToDetails.mockClear();
    backToPersona.mockClear();
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  });

  it("starts on persona step when org module is enabled", () => {
    render(<SignUpForm orgModuleEnabled />);
    expect(screen.getByText(/step 1 persona/i)).toBeInTheDocument();
    expect(screen.queryByText(/step 2 details/i)).not.toBeInTheDocument();
  });

  it("calls goToDetails when Continue is clicked on persona step", () => {
    render(<SignUpForm orgModuleEnabled />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(goToDetails).toHaveBeenCalledTimes(1);
  });

  it("shows details step when controller step is details", () => {
    mockStep = "details";
    render(<SignUpForm orgModuleEnabled />);
    expect(screen.getByText(/step 2 details/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
  });

  it("calls backToPersona when Change is clicked on details step", () => {
    mockStep = "details";
    render(<SignUpForm orgModuleEnabled />);
    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    expect(backToPersona).toHaveBeenCalledTimes(1);
  });

  it("skips persona step for invites and shows locked email on details", () => {
    mockStep = "details";
    render(
      <SignUpForm
        orgModuleEnabled
        inviteToken="invite-token-1234567890"
        invitePreview={{
          email: "invited@example.com",
          roleLabel: "Client",
          entityScoped: false,
        }}
      />,
    );
    expect(screen.getByText(/locked email: invited@example.com/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change/i })).not.toBeInTheDocument();
  });

  it("skips persona step when org module is disabled", () => {
    mockStep = "details";
    render(<SignUpForm orgModuleEnabled={false} />);
    expect(screen.getByText(/step 2 details/i)).toBeInTheDocument();
    expect(screen.queryByText(/step 1 persona/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change/i })).not.toBeInTheDocument();
  });
});
