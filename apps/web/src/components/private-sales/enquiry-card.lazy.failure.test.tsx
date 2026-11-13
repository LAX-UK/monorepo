import { EnquiryCard } from "@/components/private-sales/enquiry-card";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/** The form's validation chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));
const submit = vi.hoisted(() => vi.fn());

vi.mock("@/components/private-sales/enquiry-card.validation", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/private-sales/enquiry-card.validation")
  >("@/components/private-sales/enquiry-card.validation");
  return {
    get enquiryFormResolver() {
      chunk.loads += 1;
      if (chunk.fail) throw new Error("Loading chunk 50891 failed");
      return actual.enquiryFormResolver;
    },
  };
});

vi.mock("@/app/(marketing)/sell/private-sales/actions", () => ({
  loadEnquirerOrganisations: vi.fn(async () => []),
  startEnquiryDraft: vi.fn(async () => ({ ok: false })),
  submitPrivateSaleEnquiry: (...args: unknown[]) => submit(...args),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: null, pending: false }),
}));

async function send() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
  });
}

// Transform the chunk once up front so the first test does not spend its wait on it.
beforeAll(async () => {
  await import("@/components/private-sales/enquiry-card.validation");
}, 30_000);

// The tests run in order and share the module cache: the chunk fails, then it arrives.
describe("EnquiryCard when its validation cannot be fetched", () => {
  it("shows the send-failure notice and keeps the button usable", async () => {
    render(<EnquiryCard initialPath="sell" onAnother={vi.fn()} />);
    await send();

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("We couldn't send your message");
    expect(notice).toHaveTextContent(/Your text is still here\. Try again/);
    const button = screen.getByRole("button", { name: "Send enquiry" });
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(submit).not.toHaveBeenCalled();
  });

  it("fetches the check again on the next submit and checks the answers once it arrives", async () => {
    render(<EnquiryCard initialPath="sell" onAnother={vi.fn()} />);
    await send();
    await screen.findByText("We couldn't send your message");
    const loadsBefore = chunk.loads;
    chunk.fail = false;

    await send();

    // The real check ran: the empty form now gets the error summary, not the load notice.
    expect(await screen.findByRole("alert", { name: "There is a problem" })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't send your message")).toBeNull();
    expect(chunk.loads).toBe(loadsBefore + 1);
    expect(submit).not.toHaveBeenCalled();
  });
});
