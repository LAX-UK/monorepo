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

const ART_ID = "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11";
const chip = { label: "Not offered", tone: "neutral", marker: "hollow" } as const;
const tide = {
  id: ART_ID,
  title: "Evening Tide",
  artist: "Hannah Cole",
  medium: "Oil on canvas",
  size: "76 × 102 cm",
  stockCode: "LAX-ORI-HC-24-0042",
  catalogueStatus: "Available",
  thumbnailUrl: null,
  whereItIs: { key: "not_offered", chip },
  available: true,
  suggested: true,
} as const;
const taken = {
  ...tide,
  id: "7c2d2c0f-4b3a-4a7f-8d2e-3a8b9f0e1d22",
  title: "Tide Study III",
  stockCode: "LAX-ORI-HC-25-0051",
  available: false,
  lock: {
    reason: "live_on_lax_art",
    message: "This artwork is live on lax.art. Take it off lax.art first.",
    link: null,
  },
} as const;

const searchArtworks = vi.fn();

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
        searchArtworks={searchArtworks as never}
      />
    </StaffTooltipProvider>,
  );
}

async function pickTide(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Artwork from the register" }));
  fireEvent.click(await screen.findByRole("option", { name: /Evening Tide/ }));
}

const submit = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: "Convert to deal" }));

beforeEach(() => {
  vi.clearAllMocks();
  convert.mockResolvedValue({ ok: true, data: { reference: "PS-0012" } });
  searchArtworks.mockResolvedValue({
    ok: true,
    data: { items: [tide, taken], hasMore: false, preselected: null },
  });
});

describe("ConvertEnquiryDialog", () => {
  it("starts a sell enquiry on the seller's own work and converts it as that", async () => {
    renderDialog(false);
    const dialog = await screen.findByRole("dialog", { name: "Convert E-1042 to a deal" });
    expect(within(dialog).getByRole("radio", { name: "Not in the register" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /The seller's own work/ })).toBeChecked();
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    submit(dialog);
    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith("E-1042", {
        notInRegister: { reason: "sellers_own_work" },
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("PS-0012"));
  });

  it("converts a sell enquiry with an artwork chosen from the register", async () => {
    renderDialog(false);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "From the register" }));
    await pickTide(dialog);
    expect(within(dialog).getByRole("region", { name: "Chosen artwork" })).toBeInTheDocument();
    submit(dialog);
    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith("E-1042", { artworkRegisterId: ART_ID }),
    );
  });

  it("starts a buy enquiry on the register and sends the work with the artwork", async () => {
    renderDialog(true);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "From the register" })).toBeChecked();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Work/ }), {
      target: { value: " c-1042 " },
    });
    await pickTide(dialog);
    submit(dialog);
    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith("E-1042", {
        workReference: "c-1042",
        artworkRegisterId: ART_ID,
      }),
    );
  });

  it("lists an artwork the register would not hold as locked, with the lock's reason", async () => {
    renderDialog(true);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Artwork from the register" }));
    const option = await screen.findByRole("option", { name: /Tide Study III/ });
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(within(option).getByText(/live on lax\.art/)).toBeInTheDocument();
  });

  it("asks a buy enquiry for the work and the artwork together: summary and inline", async () => {
    renderDialog(true);
    const dialog = await screen.findByRole("dialog");
    submit(dialog);
    const summary = await within(dialog).findByRole("alert", { name: "There is a problem" });
    expect(
      within(summary).getByText("Enter the reference of the work, such as C-1042."),
    ).toBeVisible();
    expect(
      within(summary).getByText("Choose the artwork from the register, or say why it isn't there."),
    ).toBeVisible();
    // The same words sit beside each field.
    expect(
      within(dialog).getAllByText(
        "Choose the artwork from the register, or say why it isn't there.",
      ),
    ).toHaveLength(2);
    expect(convert).not.toHaveBeenCalled();
  });

  it("asks for the reason when a buy enquiry says the artwork is not in the register", async () => {
    renderDialog(true);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Work/ }), {
      target: { value: "C-1042" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Not in the register" }));
    submit(dialog);
    expect(
      await within(dialog).findAllByText("Say why it isn't in the register."),
    ).not.toHaveLength(0);
    expect(convert).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("radio", { name: /In Zoho, but not linked yet/ }));
    submit(dialog);
    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith("E-1042", {
        workReference: "C-1042",
        notInRegister: { reason: "in_zoho_not_linked" },
      }),
    );
  });

  it("shows no summary when the artwork is the only field", async () => {
    renderDialog(false);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "From the register" }));
    submit(dialog);
    expect(
      await within(dialog).findByText(
        "Choose the artwork from the register, or say why it isn't there.",
      ),
    ).toBeVisible();
    expect(within(dialog).queryByText("There is a problem")).toBeNull();
  });

  it("preselects the artwork the work's earlier lot offered, and says so", async () => {
    searchArtworks.mockResolvedValue({
      ok: true,
      data: { items: [tide], hasMore: false, preselected: tide },
    });
    renderDialog(true);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Work/ }), {
      target: { value: "C-1042" },
    });
    expect(await within(dialog).findByText("Linked to C-1042's earlier lot")).toBeVisible();
    expect(searchArtworks).toHaveBeenCalledWith({ q: "", enquiry: "E-1042", work: "C-1042" });
    submit(dialog);
    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith("E-1042", {
        workReference: "C-1042",
        artworkRegisterId: ART_ID,
      }),
    );
  });

  it("keeps the artwork the register refused, says why, and asks for another", async () => {
    convert.mockResolvedValue({
      ok: false,
      error: "This artwork is live on lax.art. Take it off lax.art first.",
      errorCode: "artwork_unavailable",
    });
    renderDialog(false);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "From the register" }));
    await pickTide(dialog);
    submit(dialog);
    expect(
      await within(dialog).findByText("That artwork can't be held for this deal"),
    ).toBeVisible();
    expect(within(dialog).getByText(/live on lax\.art/)).toBeVisible();
    expect(within(dialog).getByText("Choose an artwork that can be held.")).toBeVisible();
    expect(within(dialog).getByRole("region", { name: "Chosen artwork" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows a missing choice the API reports beside the Artwork field", async () => {
    convert.mockResolvedValue({
      ok: false,
      error: "Choose the artwork from the register, or say why it isn't there.",
      errorCode: "artwork_choice_required",
    });
    renderDialog(false);
    const dialog = await screen.findByRole("dialog");
    submit(dialog);
    expect(
      await within(dialog).findByText(
        "Choose the artwork from the register, or say why it isn't there.",
      ),
    ).toBeVisible();
    expect(within(dialog).queryByText("The enquiry couldn't be converted")).toBeNull();
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
    submit(dialog);
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
