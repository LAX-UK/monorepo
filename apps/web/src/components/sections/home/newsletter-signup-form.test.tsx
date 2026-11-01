import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("NewsletterSignupForm focus", () => {
  it("draws a light focus outline on the dark hero ground", () => {
    render(<NewsletterSignupForm tone="onDark" />);
    const form = screen.getByRole("button", { name: "Subscribe" }).closest("form");
    expect(form?.className).toContain("[--lax-focus:#fff]");
    expect(form?.className).toContain("[--color-lax-focus:#fff]");
  });

  it("keeps the default focus colour elsewhere", () => {
    render(<NewsletterSignupForm />);
    const form = screen.getByRole("button", { name: "Subscribe" }).closest("form");
    expect(form?.className).not.toContain("--lax-focus");
  });
});
