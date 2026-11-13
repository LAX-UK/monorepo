import { ContactForm } from "@/components/marketing/contact-form";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/** The form's validation chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));
const submit = vi.hoisted(() => vi.fn());

vi.mock("@/components/marketing/contact-form.validation", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/marketing/contact-form.validation")
  >("@/components/marketing/contact-form.validation");
  return {
    get contactFormResolver() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("Loading chunk 50891 failed");
      return actual.contactFormResolver;
    },
  };
});

vi.mock("@/app/(marketing)/contact/actions", () => ({
  submitContactFormResult: (values: unknown) => submit(values),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

function fillValid() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: "A question about a lot." },
  });
}

// Transform the chunk once up front so the first test does not spend its wait on it.
beforeAll(async () => {
  await import("@/components/marketing/contact-form.validation");
}, 30_000);

// The tests run in order and share the module cache: the chunk fails, then it arrives.
describe("ContactForm when its validation cannot be fetched", () => {
  it("resets the button and shows the send-failure notice instead of sticking on Sending…", async () => {
    render(<ContactForm />);
    fillValid();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("We couldn't send your message");
    expect(notice).toHaveTextContent(/Your text is still here\. Try again/);
    const button = screen.getByRole("button", { name: "Send message" });
    expect(button).not.toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Sending…")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it("fetches the check again on the next submit and sends once it arrives", async () => {
    submit.mockResolvedValue({ ok: true });
    render(<ContactForm />);
    fillValid();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });
    await screen.findByRole("alert");
    const loadsBefore = chunk.loads;
    chunk.fail = false;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(await screen.findByText("Message sent")).toBeInTheDocument();
  });
});
