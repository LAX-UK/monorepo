import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/** The form's validation chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));
const submit = vi.hoisted(() => vi.fn());

vi.mock("@/components/sections/home/newsletter-signup-form.validation", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/sections/home/newsletter-signup-form.validation")
  >("@/components/sections/home/newsletter-signup-form.validation");
  return {
    get newsletterSignupResolver() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("Loading chunk 50891 failed");
      return actual.newsletterSignupResolver;
    },
  };
});

vi.mock("@/lib/newsletter/services/newsletter.client", () => ({
  defaultNewsletterSubmitter: { submit: (email: string) => submit(email) },
}));

async function subscribe(email: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  });
}

// Transform the chunk once up front so the first test does not spend its wait on it.
beforeAll(async () => {
  await import("@/components/sections/home/newsletter-signup-form.validation");
}, 30_000);

// The tests run in order and share the module cache: the chunk fails, then it arrives.
describe("NewsletterSignupForm when its validation cannot be fetched", () => {
  it("shows the sign-up failure banner and keeps the button usable", async () => {
    render(<NewsletterSignupForm />);
    await subscribe("ada@example.com");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(
      "We could not subscribe you right now. Please try again later.",
    );
    expect(screen.getByRole("button", { name: "Subscribe" })).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("fetches the check again on the next submit and subscribes once it arrives", async () => {
    submit.mockResolvedValue({ ok: true, newsletterDisposition: "subscribed" });
    render(<NewsletterSignupForm />);
    await subscribe("ada@example.com");
    await screen.findByRole("alert");
    const loadsBefore = chunk.loads;
    chunk.fail = false;

    await subscribe("ada@example.com");

    await waitFor(() => expect(submit).toHaveBeenCalledWith("ada@example.com"));
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(await screen.findByText("You're on the list")).toBeInTheDocument();
  });
});
