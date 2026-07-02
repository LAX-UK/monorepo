import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { Form } from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { SignUpFields } from "./sign-up-fields";

function Harness({ defaults }: { defaults?: Partial<SignUpFormValues> }) {
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
      ...defaults,
    },
  });
  return (
    <Form {...form}>
      <SignUpFields control={form.control} />
    </Form>
  );
}

describe("SignUpFields", () => {
  it("does not show the work-email nudge when persona is 'individual'", () => {
    render(<Harness defaults={{ persona: "individual", email: "alice@gmail.com" }} />);
    expect(screen.queryByText(/use your work email/i)).not.toBeInTheDocument();
  });

  it("does not show the work-email nudge for organisation + work domain", () => {
    render(<Harness defaults={{ persona: "organisation", email: "bob@acme.gallery" }} />);
    expect(screen.queryByText(/use your work email/i)).not.toBeInTheDocument();
  });

  it("shows the work-email nudge for organisation + personal domain", () => {
    render(<Harness defaults={{ persona: "organisation", email: "carol@gmail.com" }} />);
    expect(screen.getByText(/use your work email/i)).toBeInTheDocument();
  });
});
