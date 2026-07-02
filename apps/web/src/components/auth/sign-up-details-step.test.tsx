import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { Form } from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { SignUpDetailsStep } from "./sign-up-details-step";

vi.mock("@/components/auth/sign-up-fields", () => ({
  SignUpFields: () => <div data-testid="sign-up-fields" />,
}));

vi.mock("@/components/auth/sign-up-legal-consent", () => ({
  SignUpLegalConsent: () => null,
}));

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => null,
}));

vi.mock("@/components/auth/social-sign-in-buttons", () => ({
  SocialSignInButtons: () => null,
}));

function DetailsHarness({ persona }: { persona: SignUpFormValues["persona"] }) {
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: { country: "GB", number: "" },
      password: "",
      persona,
      acceptTerms: false,
    },
  });

  return (
    <Form {...form}>
      <SignUpDetailsStep
        control={form.control}
        showPersonaSummary
        onChangePersona={vi.fn()}
        showWizardProgress
        isInvite={false}
        next="/dashboard"
        loginHref="/login"
        loading={false}
        turnstileReady
        turnstileSiteKey={undefined}
        onTurnstileToken={vi.fn()}
        onTurnstileExpire={vi.fn()}
      />
    </Form>
  );
}

describe("SignUpDetailsStep org roadmap preview", () => {
  it("shows org roadmap preview when persona is organisation", () => {
    render(<DetailsHarness persona="organisation" />);
    expect(screen.getByTestId("sign-up-org-next-steps")).toBeInTheDocument();
  });

  it("hides org roadmap preview when persona is individual", () => {
    render(<DetailsHarness persona="individual" />);
    expect(screen.queryByTestId("sign-up-org-next-steps")).not.toBeInTheDocument();
  });
});
