import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { Form } from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { SignUpPersonaStep } from "./sign-up-persona-step";

function Harness() {
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: { country: "GB", number: "" },
      password: "",
      persona: "individual",
      acceptTerms: false,
    },
  });
  return (
    <Form {...form}>
      <SignUpPersonaStep control={form.control} onContinue={vi.fn()} loginHref="/login" />
    </Form>
  );
}

describe("SignUpPersonaStep", () => {
  it("renders both persona options with individual selected by default", () => {
    render(<Harness />);
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
    const individual = screen.getByRole("radio", { name: /an individual/i });
    const organisation = screen.getByRole("radio", {
      name: /representing a gallery, dealer, or estate/i,
    });
    expect(individual).toBeChecked();
    expect(organisation).not.toBeChecked();
    expect(screen.queryByTestId("sign-up-org-next-steps")).not.toBeInTheDocument();
  });

  it("shows org roadmap preview when organisation is selected", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("radio", {
        name: /representing a gallery, dealer, or estate/i,
      }),
    );
    expect(screen.getByTestId("sign-up-org-next-steps")).toBeInTheDocument();
    expect(screen.getByText(/after you verify your email/i)).toBeInTheDocument();
  });

  it("calls onContinue when Continue is clicked", () => {
    const onContinue = vi.fn();
    function StepHarness() {
      const form = useForm<SignUpFormValues>({
        resolver: zodResolver(signUpFormSchema),
        defaultValues: {
          firstName: "",
          lastName: "",
          email: "",
          phone: { country: "GB", number: "" },
          password: "",
          persona: "individual",
          acceptTerms: false,
        },
      });
      return (
        <Form {...form}>
          <SignUpPersonaStep control={form.control} onContinue={onContinue} loginHref="/login" />
        </Form>
      );
    }
    render(<StepHarness />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
