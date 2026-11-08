import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvertEnquiryDialog } from "./convert-enquiry-dialog";

const convert = vi.fn();
const onDone = vi.fn();
const onReload = vi.fn();

vi.mock("@/lib/actions/admin/admin-private-sales", () => ({
  convertEnquiryAction: vi.fn(),
}));

function renderDialog(needsWork: boolean) {
  return render(
    <StaffTooltipProvider>
      <ConvertEnquiryDialog
        open
        onOpenChange={vi.fn()}
        reference="E-1042"
        needsWork={needsWork}
        onReload={onReload}
        onDone={onDone}
        convert={convert as never}
      />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  convert.mockResolvedValue({ ok: true, data: { reference: "PS-0012" } });
});

describe("ConvertEnquiryDialog", () => {
  it("converts a sell enquiry with no more details and hands back the deal's reference", async () => {
    renderDialog(false);
    const dialog = await screen.findByRole("dialog", { name: "Convert E-1042 to a deal" });
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Convert to deal" }));
    await waitFor(() => expect(convert).toHaveBeenCalledWith("E-1042", {}));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("PS-0012"));
  });

  it("asks a buy enquiry for the work, and checks it looks like a reference", async () => {
    renderDialog(true);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Convert to deal" }));
    expect(
      await within(dialog).findByText("Enter the reference of the work, such as C-1042."),
    ).toBeInTheDocument();
    expect(convert).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Work/ }), {
      target: { value: " c-1042 " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Convert to deal" }));
    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith("E-1042", { workReference: "c-1042" }),
    );
  });

  it("says why it could not convert and stays open", async () => {
    convert.mockResolvedValue({
      ok: false,
      error:
        "The sender has no LAX account yet. Invite them to create one, then convert the enquiry.",
      errorCode: "account_required",
    });
    renderDialog(false);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Convert to deal" }));
    expect(
      await within(dialog).findByText(/The sender has no LAX account yet/),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("offers a reload when the enquiry changed while it was open", async () => {
    convert.mockResolvedValue({ ok: false, error: "changed", errorCode: "stale_version" });
    renderDialog(false);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Convert to deal" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalled();
  });
});
