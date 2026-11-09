// @vitest-environment jsdom
import type { AdminRunPrint, AdminSetApartInfo } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setPrintApart = vi.fn();
const returnPrintToRun = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/server/application/edition-run-actions.server", () => ({
  setPrintApart,
  returnPrintToRun,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { SetPrintApartDialog } = await import("./set-print-apart-dialog.client");
const { SetApartCard } = await import("./set-apart-card.client");
const { RunPrintsCard } = await import("./run-prints-card.client");

const RUN = "11111111-1111-4111-8111-111111111111";
const LISTING = "22222222-2222-4222-8222-222222222222";
const EDITION = "33333333-3333-4333-8333-333333333333";
const SIGNATURE = { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" } as const;
const IDENTITY = {
  editionNumber: 3,
  proofNumber: null,
  of: { kind: "limited", size: 30 },
} as const;

const print = (overrides: Partial<AdminRunPrint> = {}): AdminRunPrint => ({
  editionId: EDITION,
  label: "3",
  owner: "lax",
  status: "on_sale",
  block: null,
  setApart: null,
  ...overrides,
});

beforeEach(() => {
  setPrintApart.mockReset();
  returnPrintToRun.mockReset();
  push.mockReset();
  toastSuccess.mockReset();
});
afterEach(cleanup);

function renderDialog(row: AdminRunPrint = print()) {
  return render(
    <SetPrintApartDialog
      open
      onOpenChange={vi.fn()}
      artworkId={RUN}
      runTitle="Tide line"
      runLine="Limited edition of 30"
      runPrice="£180.00"
      runSignature={SIGNATURE}
      print={row}
      identity={IDENTITY}
    />,
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Set print 3 apart" });

describe("Set print apart: the dialog", () => {
  it("says what the print is and that it leaves the run's queue", () => {
    renderDialog();
    expect(within(dialog()).getByText(/Tide line · Limited edition of 30/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/It leaves the run's queue/)).toBeInTheDocument();
    expect(
      within(dialog()).getByRole("button", { name: "Set apart and create listing" }),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByText(/The run sells at £180.00. A remarque usually sells higher./),
    ).toBeInTheDocument();
  });

  it("shows the details of a difference only once it is ticked", () => {
    renderDialog();
    expect(within(dialog()).queryByRole("combobox", { name: "Drawn in" })).toBeNull();
    fireEvent.click(within(dialog()).getByRole("checkbox", { name: /Remarque/ }));
    expect(within(dialog()).getByRole("combobox", { name: "Drawn in" })).toBeInTheDocument();
    expect(within(dialog()).getByRole("combobox", { name: "Place" })).toBeInTheDocument();
  });

  it("writes the wording shoppers will read from the choices", async () => {
    renderDialog();
    expect(
      within(dialog()).getByText("Choose what is different to see the wording."),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("checkbox", { name: /Remarque/ }));
    fireEvent.click(within(dialog()).getByRole("combobox", { name: "Drawn in" }));
    fireEvent.click(await screen.findByRole("option", { name: "Pencil" }));
    fireEvent.click(within(dialog()).getByRole("combobox", { name: "Place" }));
    fireEvent.click(await screen.findByRole("option", { name: "Lower margin" }));
    const preview = within(dialog()).getByRole("region", { name: "Shoppers will see" });
    expect(within(preview).getByText("Limited edition print, no. 3 of 30")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Remarque: an original drawing added by the artist in pencil, lower margin",
      ),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Basket: No. 3 · With a remarque")).toBeInTheDocument();
  });

  it("names everything that is missing, in a summary and beside each field, and sends nothing", () => {
    renderDialog();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Set apart and create listing" }));
    const form = dialog();
    expect(
      within(form).getAllByText("Say what is different about this print").length,
    ).toBeGreaterThan(0);
    expect(
      within(form).getAllByText("Enter the price this print sells for").length,
    ).toBeGreaterThan(0);
    expect(setPrintApart).not.toHaveBeenCalled();
  });

  it("sends the print, what differs and the price, then opens the new listing", async () => {
    setPrintApart.mockResolvedValue({
      ok: true,
      data: { artworkId: LISTING, slug: "tide-line-no-3", version: "v1" },
    });
    renderDialog();
    fireEvent.click(within(dialog()).getByRole("checkbox", { name: /Dedication/ }));
    fireEvent.input(within(dialog()).getByPlaceholderText("0.00"), { target: { value: "420" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Set apart and create listing" }));
    await waitFor(() => expect(setPrintApart).toHaveBeenCalledTimes(1));
    expect(setPrintApart).toHaveBeenCalledWith(
      expect.objectContaining({
        artworkId: RUN,
        editionId: EDITION,
        body: { differences: { dedicated: true }, printPricePence: 42000 },
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/artworks/${LISTING}`));
    expect(toastSuccess).toHaveBeenCalledWith("Print 3 is now listed on its own");
  });

  it("shows the reason when the request is refused, and stays open", async () => {
    setPrintApart.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "Print 3 is in a buyer's basket.",
    });
    renderDialog();
    fireEvent.click(within(dialog()).getByRole("checkbox", { name: /Dedication/ }));
    fireEvent.input(within(dialog()).getByPlaceholderText("0.00"), { target: { value: "420" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Set apart and create listing" }));
    expect(await within(dialog()).findByText(/in a buyer's basket/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("is blocked while the print is in a basket, and says until when", () => {
    renderDialog(
      print({
        label: "3",
        status: "in_basket",
        block: { kind: "in_basket", until: "2026-11-09T14:32:00.000Z" },
      }),
    );
    expect(within(dialog()).getByText("Print 3 is in a buyer's basket")).toBeInTheDocument();
    expect(within(dialog()).getByText(/reserved until 14:32 GMT/)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Set apart" })).toBeDisabled();
    expect(within(dialog()).queryByRole("checkbox")).toBeNull();
  });
});

describe("Return a print to its run", () => {
  const info: AdminSetApartInfo = {
    runArtworkId: RUN,
    runTitle: "Tide line",
    label: "3",
    printOf: "No. 3 of 30",
    differences: ["Remarque: an original drawing added by the artist in pencil, lower margin"],
    returnBlock: null,
  };

  it("shows which print of which run this is and what is different", () => {
    render(<SetApartCard artworkId={LISTING} setApart={info} canWrite />);
    expect(screen.getByText("No. 3 of 30")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tide line" })).toHaveAttribute(
      "href",
      `/artworks/${RUN}`,
    );
    expect(
      screen.getByText("Remarque: an original drawing added by the artist in pencil, lower margin"),
    ).toBeInTheDocument();
  });

  it("asks before returning, then goes to the run", async () => {
    returnPrintToRun.mockResolvedValue({ ok: true, data: { artworkId: RUN, version: "v2" } });
    render(<SetApartCard artworkId={LISTING} setApart={info} canWrite />);
    fireEvent.click(screen.getByRole("button", { name: "Return print 3 to the run" }));
    const confirm = screen.getByRole("dialog", { name: "Return print 3 to the run?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Return print 3" }));
    await waitFor(() =>
      expect(returnPrintToRun).toHaveBeenCalledWith(
        expect.objectContaining({ artworkId: LISTING }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/artworks/${RUN}`));
    expect(toastSuccess).toHaveBeenCalledWith("Print 3 is back in Tide line");
  });

  it("cannot return a print that has sold, and says so", () => {
    render(
      <SetApartCard
        artworkId={LISTING}
        setApart={{ ...info, returnBlock: { kind: "sold", until: null } }}
        canWrite
      />,
    );
    expect(screen.getByRole("button", { name: "Return print 3 to the run" })).toBeDisabled();
    expect(screen.getByText("Print 3 is sold")).toBeInTheDocument();
  });

  it("offers no way back to people who cannot write the catalogue", () => {
    render(<SetApartCard artworkId={LISTING} setApart={info} canWrite={false} />);
    expect(screen.queryByRole("button", { name: /Return print/ })).toBeNull();
  });
});

describe("The Prints table", () => {
  const spec = { type: "lax_standard" } as const;
  const rows: AdminRunPrint[] = [
    print({ editionId: "e-1", label: "1", status: "sold", owner: "artist" }),
    print({ editionId: "e-2", label: "2" }),
    print({
      editionId: "e-3",
      label: "3",
      status: "set_apart",
      block: { kind: "already_apart", until: null },
      setApart: {
        listingArtworkId: LISTING,
        title: "Tide line (no. 3, with a remarque)",
        differences: [],
      },
    }),
  ];

  function renderTable(permissions = { write: true, setPrice: true }) {
    return render(
      <RunPrintsCard
        artworkId={RUN}
        title="Tide line"
        spec={spec}
        runPrice="£180.00"
        runSignature={SIGNATURE}
        prints={rows}
        permissions={permissions}
      />,
    );
  }

  it("lists every print with who holds it and where it stands", () => {
    renderTable();
    expect(screen.getAllByText("Sold").length).toBeGreaterThan(0);
    expect(screen.getAllByText("On sale").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sold on its own").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Tide line (no. 3, with a remarque)" })[0],
    ).toHaveAttribute("href", `/artworks/${LISTING}`);
  });

  it("offers 'Set this print apart…' on a print that can be, not on a sold one", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: "Actions for print 1" })).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Actions for print 2" })[0] as HTMLElement,
    );
    expect(
      screen.getAllByRole("menuitem", { name: "Set this print apart…" }).length,
    ).toBeGreaterThan(0);
  });

  it("links a print that is set apart to its listing instead", () => {
    renderTable();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Actions for print 3" })[0] as HTMLElement,
    );
    expect(screen.getAllByRole("menuitem", { name: "Open its listing" }).length).toBeGreaterThan(0);
  });

  it("opens the dialog for the chosen print", () => {
    renderTable();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Actions for print 2" })[0] as HTMLElement,
    );
    fireEvent.click(
      screen.getAllByRole("menuitem", { name: "Set this print apart…" })[0] as HTMLElement,
    );
    expect(screen.getByRole("dialog", { name: "Set print 2 apart" })).toBeInTheDocument();
  });

  it("offers nothing to people who cannot write the catalogue", () => {
    renderTable({ write: false, setPrice: false });
    expect(screen.queryByRole("button", { name: /Actions for print/ })).toBeNull();
  });
});
