import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("NewsletterSignupForm focus", () => {
  it("keeps the default focus colour elsewhere", () => {
    render(<NewsletterSignupForm />);
    const form = screen.getByRole("button", { name: "Subscribe" }).closest("form");
    expect(form?.className).not.toContain("--lax-focus");
  });

  it("explains an empty submit at the field and in a summary that takes focus", async () => {
    render(<NewsletterSignupForm />);
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toContain("Enter an email address");
    expect(screen.getByLabelText("Email address").getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(summary));
  });
});
