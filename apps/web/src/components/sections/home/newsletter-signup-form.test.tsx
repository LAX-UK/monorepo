import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

// The form's check is loaded on first use; load it once up front so the first test does not
// spend its wait on transforming the module.
beforeAll(async () => {
  await import("@/components/sections/home/newsletter-signup-form.validation");
}, 30_000);

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
