import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealArtworkDialog } from "./deal-artwork-dialog";
import { DealArtworkSection } from "./deal-artwork-section";
import { dealRecord } from "./deal.fixture";
import { RemoveDealArtworkDialog } from "./remove-deal-artwork-dialog";

vi.mock("@/lib/actions/admin/admin-private-sales", () => ({
  setDealArtworkAction: vi.fn(),
  removeDealArtworkAction: vi.fn(),
  searchDealArtworksAction: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const OTHER_ID = "7c2d2c0f-4b3a-4a7f-8d2e-3a8b9f0e1d22";
const chip = { label: "Not offered", tone: "neutral", marker: "hollow" } as const;
const study = {
  id: OTHER_ID,
  title: "Morning Tide",
  artist: "Hannah Cole",
  medium: "Oil on canvas",
  size: "76 x 102 cm",
  stockCode: "LAX-ORI-HC-24-0043",
  catalogueStatus: "Available",
  thumbnailUrl: null,
  whereItIs: {
    key: "draft_bid_lot",
    chip: { label: "Draft lot in LAX Bid", tone: "info", marker: "hollow" },
  },
  available: true,
  suggested: false,
  draftLot: { saleName: "Winter Modern" },
} as const;
const lotLocked = {
  ...study,
  id: "9e3e3d1a-5c4b-4b8a-9e3f-4b9c0a1f2e33",
  title: "Tide Study III",
  whereItIs: {
    key: "bid_sale",
    chip: { label: "In a LAX Bid sale", tone: "info", marker: "filled" },
  },
  available: false,
  lock: {
    reason: "in_bid_sale",
    message:
      "This artwork is in a LAX Bid sale (Winter Modern, lot 14). Withdraw the lot there first.",
    link: { label: "Open lot in LAX Bid", target: "bid_lot", href: "/admin/lots/lot-14" },
  },
} as const;
void chip;

const noop = () => undefined;
const unlinked = (over = {}) =>
  dealRecord({
    artwork: null,
    artworkAccess: { canLink: true, canChange: false, changeOffReason: null },
    artworkUnlinkedReason: "in_zoho_not_linked",
    ...over,
  });

function renderSection(deal = dealRecord()) {
  const onLink = vi.fn();
  const onChange = vi.fn();
  const onRemove = vi.fn();
  render(
    <StaffTooltipProvider>
      <DealArtworkSection deal={deal} onLink={onLink} onChange={onChange} onRemove={onRemove} />
    </StaffTooltipProvider>,
  );
  return { onLink, onChange, onRemove, region: screen.getByRole("region", { name: "Artwork" }) };
}

describe("DealArtworkSection: a linked artwork", () => {
  it("shows the artwork, where it is, since when, and the facts with its record in LAX Admin", () => {
    const { region } = renderSection();
    expect(within(region).getByText("Evening Tide")).toBeInTheDocument();
    expect(within(region).getByText(/Hannah Cole · LAX-ORI-HC-24-0042/)).toBeInTheDocument();
    expect(within(region).getByText("In a private sale")).toBeInTheDocument();
    expect(within(region).getByText("Held for this deal")).toBeInTheDocument();
    expect(
      within(region).getByText(/Nothing else can offer it while the deal is open/),
    ).toBeInTheDocument();
    expect(within(region).getByText("Available")).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: /From Zoho record/ })).toHaveAttribute(
      "href",
      "https://admin.lax.test/from-zoho/reg-1",
    );
  });

  it("offers Change and Remove, each opening its own step, and no Link", () => {
    const { region, onChange, onRemove } = renderSection();
    expect(within(region).queryByRole("button", { name: "Link artwork…" })).toBeNull();
    fireEvent.click(within(region).getByRole("button", { name: "Change artwork…" }));
    fireEvent.click(within(region).getByRole("button", { name: "Remove artwork…" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("says change is off from Agreed, and offers no way to change", () => {
    const { region } = renderSection(
      dealRecord({
        stage: "agreed",
        artworkAccess: {
          canLink: false,
          canChange: false,
          changeOffReason: "Change artwork is off from Agreed onwards.",
        },
      }),
    );
    expect(
      within(region).getByText("Change artwork is off from Agreed onwards."),
    ).toBeInTheDocument();
    expect(within(region).getByText(/Locked to this deal from Agreed/)).toBeInTheDocument();
    expect(within(region).queryByRole("button")).toBeNull();
  });

  it.each([["paid", /Paid\. The register marks it sold when the deal settles\./]] as const)(
    "at %s says when the register marks it sold",
    (stage, note) => {
      const { region } = renderSection(
        dealRecord({
          stage,
          artworkAccess: { canLink: false, canChange: false, changeOffReason: null },
        }),
      );
      expect(within(region).getByText(note)).toBeInTheDocument();
    },
  );

  it("shows a settled deal's artwork as sold privately, with the deal and the date", () => {
    const { region } = renderSection(
      dealRecord({
        stage: "settled",
        artworkAccess: { canLink: false, canChange: false, changeOffReason: null },
        artwork: {
          ...(dealRecord().artwork as NonNullable<ReturnType<typeof dealRecord>["artwork"]>),
          whereItIs: { key: "sold", chip: { label: "Sold", tone: "neutral", marker: "check" } },
        },
        timeline: [
          {
            fromStage: "released",
            toStage: "settled",
            reason: null,
            createdAt: "2026-11-30T16:00:00.000Z",
            actorName: null,
          },
        ],
      }),
    );
    expect(within(region).getByText("Sold privately")).toBeInTheDocument();
    expect(within(region).getByText(/PS-0012, Mon 30 Nov, 16:00 GMT/)).toBeInTheDocument();
    expect(
      within(region).getByText("Sold is final. Nothing can offer it again."),
    ).toBeInTheDocument();
  });

  it("shows a cancelled deal's artwork as withdrawn and free to be offered again", () => {
    const { region } = renderSection(
      dealRecord({
        stage: "cancelled",
        cancelledAt: "2026-11-13T10:00:00.000Z",
        artworkAccess: { canLink: false, canChange: false, changeOffReason: null },
        artwork: {
          ...(dealRecord().artwork as NonNullable<ReturnType<typeof dealRecord>["artwork"]>),
          whereItIs: {
            key: "withdrawn",
            chip: { label: "Withdrawn", tone: "warning", marker: "filled" },
          },
        },
      }),
    );
    expect(within(region).getByText(/from a private sale/)).toBeInTheDocument();
    expect(
      within(region).getByText("Released when the deal was cancelled. It can be offered again."),
    ).toBeInTheDocument();
  });
});

describe("DealArtworkSection: no register artwork", () => {
  it("says it is not linked, that nothing stops it being offered elsewhere, and leads with Link", () => {
    const { region, onLink } = renderSection(unlinked());
    expect(within(region).getByText("Not linked")).toBeInTheDocument();
    expect(within(region).getByText("Not linked to the register")).toBeInTheDocument();
    expect(
      within(region).getByText(/The deal can't be agreed until it is linked\./),
    ).toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Link artwork…" }));
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(within(region).queryByRole("button", { name: /Change|Remove/ })).toBeNull();
  });

  it("treats an unrecorded reason like a note that it still has to be linked", () => {
    const { region } = renderSection(unlinked({ artworkUnlinkedReason: null }));
    expect(within(region).getByText("Not linked to the register")).toBeInTheDocument();
  });

  it("says a seller's own work needs no hold, and still lets staff link it", () => {
    const { region } = renderSection(unlinked({ artworkUnlinkedReason: "sellers_own_work" }));
    expect(within(region).getByText("Not in the register")).toBeInTheDocument();
    expect(within(region).getByText("The seller's own work")).toBeInTheDocument();
    expect(within(region).getByText(/No hold is needed\./)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Link artwork…" })).toBeInTheDocument();
  });

  it("is view-only for a person who cannot run deals: the words, no buttons", () => {
    const { region } = renderSection(
      unlinked({ artworkAccess: { canLink: false, canChange: false, changeOffReason: null } }),
    );
    expect(within(region).getByText("Not linked to the register")).toBeInTheDocument();
    expect(within(region).queryByRole("button")).toBeNull();
  });
});

describe("DealArtworkDialog", () => {
  const set = vi.fn();
  const search = vi.fn();
  const onDone = vi.fn();
  const onReload = vi.fn();

  function renderDialog(
    mode: "link" | "change",
    deal = mode === "link" ? unlinked() : dealRecord(),
  ) {
    render(
      <StaffTooltipProvider>
        <DealArtworkDialog
          open
          onOpenChange={vi.fn()}
          mode={mode}
          deal={deal}
          onReload={onReload}
          onDone={onDone}
          set={set as never}
          searchArtworks={search as never}
        />
      </StaffTooltipProvider>,
    );
    return screen.getByRole("dialog");
  }
  const pick = async (dialog: HTMLElement, name: RegExp) => {
    fireEvent.click(within(dialog).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ ok: true, data: dealRecord() });
    search.mockResolvedValue({
      ok: true,
      data: { items: [study, lotLocked], hasMore: false, preselected: null },
    });
  });

  it("links: shows the chosen artwork to review, holds it, and says so", async () => {
    const dialog = renderDialog("link");
    expect(within(dialog).getByText("Link the artwork to PS-0012")).toBeInTheDocument();
    await pick(dialog, /Morning Tide/);
    expect(within(dialog).getByRole("region", { name: "Chosen artwork" })).toBeInTheDocument();
    expect(within(dialog).getByText(/A draft lot in Winter Modern is linked/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Link and hold" }));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith("PS-0012", { version: 4, artworkRegisterId: OTHER_ID }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("link"));
  });

  it("asks the register with the enquiry and the work, so the suggestions lead", async () => {
    const dialog = renderDialog("link");
    fireEvent.click(within(dialog).getByRole("combobox"));
    await screen.findByRole("option", { name: /Morning Tide/ });
    expect(search).toHaveBeenCalledWith({ q: "", enquiry: "E-1042", work: "C-1042" });
  });

  it("with one field, shows the missing artwork beside it and no summary", async () => {
    const dialog = renderDialog("link");
    fireEvent.click(within(dialog).getByRole("button", { name: "Link and hold" }));
    expect(
      await within(dialog).findByText("Choose the artwork to hold for this deal."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/There (is|are) \d? ?problems?/)).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it("change: needs the artwork and a reason, with a summary and a message beside each", async () => {
    const dialog = renderDialog("change");
    expect(within(dialog).getByText("Change the artwork on PS-0012")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Releases Evening Tide and holds the new artwork/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Change artwork" }));
    const summary = await within(dialog).findByRole("alert", { name: "There is a problem" });
    expect(within(summary).getByText("Choose the new artwork.")).toBeInTheDocument();
    expect(within(summary).getByText("Say why the artwork is being changed.")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Choose the new artwork.").length).toBeGreaterThan(0);
    expect(
      within(dialog).getAllByText("Say why the artwork is being changed.").length,
    ).toBeGreaterThan(0);
    expect(set).not.toHaveBeenCalled();
  });

  it("change: sends the artwork and the reason", async () => {
    const dialog = renderDialog("change");
    await pick(dialog, /Morning Tide/);
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason/ }), {
      target: { value: " The buyer chose the earlier study. " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Change artwork" }));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith("PS-0012", {
        version: 4,
        artworkRegisterId: OTHER_ID,
        reason: "The buyer chose the earlier study.",
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("change"));
  });

  it("shows the lock's own words and link when the register refuses, keeps the choice and the reason, and asks again", async () => {
    const dialog = renderDialog("change");
    await pick(dialog, /Morning Tide/);
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason/ }), {
      target: { value: "Prefer this one." },
    });
    set.mockResolvedValueOnce({
      ok: false,
      error: lotLocked.lock.message,
      errorCode: "artwork_unavailable",
      meta: { lock: lotLocked.lock },
    });
    search.mockClear();
    fireEvent.click(within(dialog).getByRole("button", { name: "Change artwork" }));
    const title = await within(dialog).findByText("That artwork can't be held for this deal");
    const notice = title.closest("[role=alert]") as HTMLElement;
    expect(within(notice).getByText(lotLocked.lock.message)).toBeInTheDocument();
    expect(within(notice).getByRole("link", { name: /Open lot in LAX Bid/ })).toHaveAttribute(
      "href",
      "/admin/lots/lot-14",
    );
    // A refusal has its own notice: its message is beside the field, not repeated in a summary.
    expect(
      screen.getAllByText(
        "Choose an artwork that can be held. Evening Tide is still held for this deal.",
      ),
    ).toHaveLength(1);
    expect(within(dialog).getByRole("textbox", { name: /Reason/ })).toHaveValue("Prefer this one.");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("offers a reload when the deal changed while the dialog was open", async () => {
    set.mockResolvedValueOnce({ ok: false, error: "x", errorCode: "stale_version" });
    const dialog = renderDialog("link");
    await pick(dialog, /Morning Tide/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Link and hold" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalled();
  });
});

describe("RemoveDealArtworkDialog", () => {
  const remove = vi.fn();
  const onDone = vi.fn();
  function renderDialog() {
    render(
      <StaffTooltipProvider>
        <RemoveDealArtworkDialog
          open
          onOpenChange={vi.fn()}
          deal={dealRecord()}
          onReload={noop}
          onDone={onDone}
          remove={remove as never}
        />
      </StaffTooltipProvider>,
    );
    return screen.getByRole("dialog");
  }
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ ok: true, data: dealRecord() });
  });

  it("states the effect first, and starts on the reason that keeps the deal from being agreed", () => {
    const dialog = renderDialog();
    expect(within(dialog).getByText("Remove the artwork from PS-0012?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Releases Evening Tide. It shows as Withdrawn for 30 days and can be offered again.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("radio", { name: /In Zoho, but not linked yet/ }),
    ).toBeChecked();
    expect(
      within(dialog).getByText("The deal can't be agreed until an artwork is linked again."),
    ).toBeInTheDocument();
  });

  it("removes with the chosen reason and an optional note", async () => {
    const dialog = renderDialog();
    fireEvent.click(within(dialog).getByRole("radio", { name: /The seller's own work/ }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Note/ }), {
      target: { value: "Wrong record picked." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove and release" }));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith("PS-0012", {
        version: 4,
        notInRegister: { reason: "sellers_own_work" },
        reason: "Wrong record picked.",
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("sends no note when none is given, and shows a refusal in the dialog", async () => {
    remove.mockResolvedValueOnce({
      ok: false,
      error: "The artwork can't be changed at this stage.",
      errorCode: "artwork_locked",
    });
    const dialog = renderDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove and release" }));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith("PS-0012", {
        version: 4,
        notInRegister: { reason: "in_zoho_not_linked" },
      }),
    );
    expect(
      await within(dialog).findByText("The artwork can't be changed at this stage."),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
