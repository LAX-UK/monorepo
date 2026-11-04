import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("NewsletterSignupForm focus", () => {
  it("keeps the default focus colour elsewhere", () => {
    render(<NewsletterSignupForm />);
    const form = screen.getByRole("button", { name: "Subscribe" }).closest("form");
    expect(form?.className).not.toContain("--lax-focus");
  });

  it("explains an empty submit under the field only, and focuses the field", async () => {
    render(<NewsletterSignupForm />);
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    const input = screen.getByLabelText("Email address");
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.queryByText("There is a problem")).toBeNull();
    expect(screen.getAllByText(/Enter an email address/)).toHaveLength(1);
    expect(document.activeElement).toBe(input);
  });
});
