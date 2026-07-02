import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignUpOrgNextSteps } from "./sign-up-org-next-steps";

describe("SignUpOrgNextSteps", () => {
  it("renders heading, duration copy, and all org onboarding step labels", () => {
    render(<SignUpOrgNextSteps />);

    expect(screen.getByText(/after you verify your email/i)).toBeInTheDocument();
    expect(screen.getByText(/about 20 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/your progress saves automatically/i)).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getByText("Identity")).toBeInTheDocument();
  });
});
