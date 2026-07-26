import { SignupPersonaBadge } from "@/components/admin/signup-persona-badge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SignupPersonaBadge", () => {
  it("renders visible label and accessible name for individual", () => {
    render(<SignupPersonaBadge persona="individual" />);
    expect(screen.getByText("Individual")).toBeInTheDocument();
    expect(screen.getByLabelText("Individual signup persona")).toBeInTheDocument();
  });

  it("applies categorical palette data attribute", () => {
    render(<SignupPersonaBadge persona="organisation" />);
    const badge = screen.getByLabelText("Organisation signup persona");
    expect(badge).toHaveAttribute("data-signup-persona", "organisation");
    expect(badge.className).toMatch(/signup-persona-badge/);
  });

  it("renders unset persona with help icon palette", () => {
    render(<SignupPersonaBadge persona={null} />);
    const badge = screen.getByLabelText("Signup persona not set");
    expect(badge).toHaveAttribute("data-signup-persona", "unset");
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });
});
