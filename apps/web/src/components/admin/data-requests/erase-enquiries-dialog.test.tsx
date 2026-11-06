import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EraseEnquiriesDialog } from "./erase-enquiries-dialog";

const EMAIL = "margaret.osei@outlook.co.uk";
const submit = vi.fn();
const onDone = vi.fn();
const onOpenChange = vi.fn();

function open() {
  return render(
    <EraseEnquiriesDialog
      open
      onOpenChange={onOpenChange}
      reference="DR-0012"
      email={EMAIL}
      submit={submit}
      onDone={onDone}
    />,
  );
}

function fill(confirmation: string, reason: string) {
  fireEvent.change(screen.getByLabelText("Type the email address to confirm"), {
    target: { value: confirmation },
  });
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: reason } });
}

beforeEach(() => vi.clearAllMocks());

describe("EraseEnquiriesDialog", () => {
  it("states the consequence and sends nothing until confirmed", () => {
    open();
    expect(screen.getByText(/can't be undone/)).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it("stops a mismatched address and a short reason before sending", async () => {
    open();
    fill("someone@else.com", "no");
    fireEvent.click(screen.getByRole("button", { name: "Erase enquiries" }));
    expect(
      (await screen.findAllByText("The email address you typed doesn't match.")).length,
    ).toBeGreaterThan(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it("sends the address and reason, then reports the counts", async () => {
    const counts = { enquiries: 2, notes: 0, attachments: 0, held: 1 };
    submit.mockResolvedValue({ ok: true, data: counts });
    open();
    fill(EMAIL, "Asked to be forgotten");
    fireEvent.click(screen.getByRole("button", { name: "Erase enquiries" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(counts));
    expect(submit).toHaveBeenCalledWith({
      email: EMAIL,
      confirmation: EMAIL,
      reason: "Asked to be forgotten",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a refusal where it was made and keeps the dialog open", async () => {
    submit.mockResolvedValue({
      ok: false,
      error: "The enquiries service didn't answer. Nothing was changed. Try again.",
    });
    open();
    fill(EMAIL, "Asked to be forgotten");
    fireEvent.click(screen.getByRole("button", { name: "Erase enquiries" }));
    expect(await screen.findByText("The enquiries couldn't be erased")).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});
