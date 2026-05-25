import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { SignUpFields } from "./sign-up-fields";

function Harness({
  defaults,
  orgModuleEnabled = true,
}: {
  defaults?: Partial<SignUpFormValues>;
  orgModuleEnabled?: boolean;
}) {
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
      persona: "individual",
      acceptTerms: false,
      ...defaults,
    },
  });
  return <SignUpFields control={form.control} orgModuleEnabled={orgModuleEnabled} />;
}

describe("SignUpFields persona selector", () => {
  it("hides persona selector when org module disabled", () => {
    render(<Harness orgModuleEnabled={false} />);
    expect(screen.queryByRole("group", { name: /i'm joining as/i })).not.toBeInTheDocument();
  });

  it("renders the persona group with both options and 'individual' selected by default", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: /i'm joining as/i });
    expect(group).toBeInTheDocument();
    const individual = screen.getByRole("radio", { name: /an individual/i });
    const organisation = screen.getByRole("radio", {
      name: /representing a gallery, dealer, or estate/i,
    });
    expect(individual).toBeChecked();
    expect(organisation).not.toBeChecked();
  });

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

  it("toggles the nudge live when the user switches persona to organisation", () => {
    render(<Harness defaults={{ persona: "individual", email: "carol@hotmail.com" }} />);
    expect(screen.queryByText(/use your work email/i)).not.toBeInTheDocument();

    const organisationRadio = screen.getByRole("radio", {
      name: /representing a gallery, dealer, or estate/i,
    });
    fireEvent.click(organisationRadio);
    expect(screen.getByText(/use your work email/i)).toBeInTheDocument();
  });
});
