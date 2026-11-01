import { ContactForm } from "@/components/marketing/contact-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submit = vi.fn();

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function leave(label: string) {
  fireEvent.blur(screen.getByLabelText(label));
}

function fillValid() {
  type("First name", "Ada");
  type("Email", "ada@example.com");
  type("Message", "A question about a lot.");
}

vi.mock("@/app/(marketing)/contact/actions", () => ({
  submitContactFormResult: (values: unknown) => submit(values),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("ContactForm", () => {
  beforeEach(() => {
    submit.mockReset();
    document.title = "Contact";
  });

  it("shows a summary that takes focus and names each problem in plain words", async () => {
    render(<ContactForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const summary = await screen.findByRole("alert", { name: "There is a problem" });
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getAllByText("Enter your first name")).toHaveLength(2);
    expect(screen.getAllByText("Enter your email address")).toHaveLength(2);
    expect(screen.getAllByText("Enter your message")).toHaveLength(2);
    expect(document.title).toBe("Error: Contact");
    expect(submit).not.toHaveBeenCalled();
  });

  it("links each summary line to its field", async () => {
    render(<ContactForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    const link = await screen.findByRole("link", { name: "Enter your email address" });
    expect(link).toHaveAttribute("href", "#contact-email");
    fireEvent.click(link);
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("rechecks a field when it is left, once the form has been submitted", async () => {
    render(<ContactForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByRole("alert", { name: "There is a problem" });

    type("Email", "not-an-email");
    leave("Email");
    await waitFor(() =>
      expect(screen.getAllByText("Enter an email address like name@example.com")).toHaveLength(2),
    );

    type("Email", "ada@example.com");
    leave("Email");
    await waitFor(() =>
      expect(screen.queryByText("Enter an email address like name@example.com")).toBeNull(),
    );
  });

  it("does not show errors before the first submit", async () => {
    render(<ContactForm />);
    leave("Email");
    expect(screen.queryByText("Enter your email address")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what went wrong when sending fails and keeps what was typed", async () => {
    submit.mockResolvedValue({ ok: false, error: "boom" });
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("We couldn't send your message")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("A question about a lot.");
  });

  it("confirms with a success notice once sent", async () => {
    submit.mockResolvedValue({ ok: true, data: undefined });
    render(<ContactForm />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Message sent")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("we've received your message");
  });
});
