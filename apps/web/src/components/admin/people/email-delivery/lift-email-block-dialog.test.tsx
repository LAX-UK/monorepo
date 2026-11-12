import type { EmailBlockView } from "@auction/types";
import { TooltipProvider } from "@auction/ui/lax/tooltip";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiftEmailBlockDialog } from "./lift-email-block-dialog";

const refresh = vi.fn();
const toastSuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin/email-delivery", () => ({ liftEmailBlockAction: vi.fn() }));
vi.mock("@auction/staff-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/staff-ui")>()),
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const BOUNCE: EmailBlockView = {
  reason: "hard_bounce",
  since: "2026-10-28T16:02:00.000Z",
  providerDetail: null,
  stopsEssentialEmail: true,
  liftReasons: ["mailbox_fixed", "other"],
  noteRequired: false,
  writtenRequestRequired: false,
  lift: { allowed: true },
};
const COMPLAINT: EmailBlockView = {
  ...BOUNCE,
  reason: "complaint",
  liftReasons: ["asked_to_receive_again"],
  noteRequired: true,
  writtenRequestRequired: true,
};

function open(block: EmailBlockView, lift = vi.fn()) {
  const onOpenChange = vi.fn();
  render(
    <TooltipProvider>
      <LiftEmailBlockDialog
        open
        onOpenChange={onOpenChange}
        userId="user-1"
        personName="Ana Duarte"
        email="ana@example.com"
        block={block}
        skippedCount={2}
        lift={lift}
      />
    </TooltipProvider>,
  );
  return { lift, onOpenChange };
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Lift block" }));

describe("LiftEmailBlockDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the person and the effect, and says skipped emails are not resent", () => {
    open(BOUNCE);
    expect(screen.getByText("Lift the email block for Ana Duarte?")).toBeTruthy();
    expect(screen.getByText(/2 emails not sent while blocked/)).toBeTruthy();
  });

  it("asks for a reason on submit without calling the server", () => {
    const { lift } = open(BOUNCE);
    submit();
    expect(screen.getAllByText("Choose why you’re lifting the block.").length).toBeGreaterThan(0);
    expect(lift).not.toHaveBeenCalled();
  });

  it("sends the reason with the block as the screen saw it, then confirms and closes", async () => {
    const lift = vi.fn().mockResolvedValue({ ok: true, data: { provider: { status: "queued" } } });
    const { onOpenChange } = open(BOUNCE, lift);
    fireEvent.click(screen.getByRole("radio", { name: /fixed their mailbox/ }));
    submit();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(lift).toHaveBeenCalledWith("user-1", {
      reason: "mailbox_fixed",
      expectedSince: BOUNCE.since,
    });
    expect(refresh).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Block lifted. Ana’s next email will be sent.");
  });

  it("keeps the dialog and says nothing changed when the request fails", async () => {
    const lift = vi.fn().mockResolvedValue({ ok: false, error: "Try again.", status: 500 });
    const { onOpenChange } = open(BOUNCE, lift);
    fireEvent.click(screen.getByRole("radio", { name: /fixed their mailbox/ }));
    submit();
    expect(await screen.findByText("The block couldn’t be lifted. Nothing changed.")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("says who lifted it first when the block changed meanwhile", async () => {
    const lift = vi.fn().mockResolvedValue({
      ok: false,
      error: "block_already_lifted",
      status: 409,
      meta: { liftedAt: "2026-11-03T10:41:00.000Z", liftedBy: "Sam Okoye" },
    });
    open(BOUNCE, lift);
    fireEvent.click(screen.getByRole("radio", { name: /fixed their mailbox/ }));
    submit();
    expect(
      await screen.findByRole("heading", { name: "This block was already lifted" }),
    ).toBeTruthy();
    expect(screen.getAllByText(/Sam Okoye lifted it/).length).toBeGreaterThan(0);
    expect(refresh).toHaveBeenCalled();
  });

  it("needs where they asked and the written tick for a complaint, and warns about alerts", () => {
    const { lift } = open(COMPLAINT);
    expect(screen.getByText("Alert emails stay off")).toBeTruthy();
    submit();
    expect(screen.getAllByText("Confirm they asked in writing.").length).toBeGreaterThan(0);
    expect(lift).not.toHaveBeenCalled();
  });

  it("stays open with the provider result when the provider still blocks the address", async () => {
    const lift = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        provider: { status: "still_blocked", message: "Postmark still blocks this address" },
      },
    });
    const { onOpenChange } = open(COMPLAINT, lift);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Email on 2 Nov" } });
    fireEvent.click(screen.getByRole("checkbox"));
    submit();
    expect(await screen.findByText(/Postmark still blocks this address/)).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
