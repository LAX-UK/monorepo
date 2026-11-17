import { formatStaffDate } from "@auction/staff-ui";
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const assess = vi.fn();
const sales = vi.fn();
const offer = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/admin-inventory-actions.server", () => ({
  getAuctionOfferAssessment: (...args: unknown[]) => assess(...args),
  listAuctionSales: (...args: unknown[]) => sales(...args),
  offerAtAuction: (...args: unknown[]) => offer(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { OfferAtAuctionDialog } = await import("./offer-at-auction-dialog.client");

const ARTWORK_ID = "11111111-1111-4111-8111-111111111111";
const REGISTER_ID = "22222222-2222-4222-8222-222222222222";
const SALE_ID = "33333333-3333-4333-8333-333333333333";
const LOT_ID = "44444444-4444-4444-8444-444444444444";

const eligible = {
  ok: true,
  data: {
    registerId: REGISTER_ID,
    artworkId: ARTWORK_ID,
    title: "Blue room",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    onLaxArt: true,
    laxArtDraft: false,
    draftLot: null,
    holdingLotId: null,
    eligible: true,
    zohoPrice: null,
    blockers: [],
    // No consignor set yet: the checkbox is the fallback until 31 January 2027.
    consignorAgreement: {
      place: "lax_bid",
      state: "no_consignor",
      outcome: "checkbox_fallback",
      checkboxFallbackUntil: "2027-01-31",
      consignor: null,
      agreement: null,
      lowestPricePence: null,
      canAddAgreement: false,
    },
  },
};
const fromZoho = {
  ok: true,
  data: { ...eligible.data, artworkId: null, onLaxArt: false },
};
const blocked = (blockers: Array<{ message: string; link: unknown }>, over = {}) => ({
  ok: true,
  data: { ...eligible.data, eligible: false, blockers, ...over },
});
const oneSale = {
  ok: true,
  data: {
    connected: true,
    sales: [{ id: SALE_ID, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" }],
  },
};
const noLinks = { bidAdminUrl: null, zohoUrl: null };
const artwork = { kind: "artwork", artworkId: ARTWORK_ID } as const;
const register = { kind: "register", registerId: REGISTER_ID } as const;

function open(
  target: typeof artwork | typeof register = artwork,
  links: { bidAdminUrl: string | null; zohoUrl: string | null } = noLinks,
) {
  render(
    <OfferAtAuctionDialog
      open
      onOpenChange={vi.fn()}
      target={target}
      title="Blue room"
      links={links}
    />,
  );
}

async function fillAndSubmit() {
  fireEvent.change(await screen.findByLabelText("Starting price"), { target: { value: "250" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /consignor agreed/ }));
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: /Winter sale/ }));
  fireEvent.click(screen.getByRole("button", { name: "Offer at auction" }));
}

describe("OfferAtAuctionDialog", () => {
  beforeEach(() => {
    for (const fn of [assess, sales, offer, refresh]) fn.mockReset();
  });

  it("checks the artwork the dialog was opened from", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    open(register);
    await screen.findByLabelText("Starting price");
    expect(assess).toHaveBeenCalledWith(register);
  });

  describe("Zoho's price", () => {
    const priced = (zohoPrice: string | null) => ({
      ok: true,
      data: { ...eligible.data, zohoPrice },
    });

    it("shows Zoho's price beside the starting price, and flags nothing until they differ", async () => {
      assess.mockResolvedValue(priced("4800.00"));
      sales.mockResolvedValue(oneSale);
      open(register);
      const price = await screen.findByLabelText("Starting price");
      expect(screen.getByText(/Zoho's price is £4,800\.00/)).toBeInTheDocument();
      expect(screen.queryByText(/differs from Zoho's price/)).not.toBeInTheDocument();
      fireEvent.change(price, { target: { value: "4800" } });
      expect(screen.queryByText(/differs from Zoho's price/)).not.toBeInTheDocument();
    });

    it("flags a different starting price in a neutral tone, without blocking the offer", async () => {
      assess.mockResolvedValue(priced("4800.00"));
      sales.mockResolvedValue(oneSale);
      open(register);
      fireEvent.change(await screen.findByLabelText("Starting price"), {
        target: { value: "3900" },
      });
      const flag = screen.getByText("This differs from Zoho's price");
      expect(flag.closest("[data-tone]")).toHaveAttribute("data-tone", "info");
      expect(screen.getByRole("button", { name: "Offer at auction" })).toBeEnabled();
    });

    it("says nothing about Zoho's price when Zoho has none", async () => {
      assess.mockResolvedValue(priced(null));
      sales.mockResolvedValue(oneSale);
      open(register);
      fireEvent.change(await screen.findByLabelText("Starting price"), {
        target: { value: "3900" },
      });
      expect(screen.queryByText(/Zoho's price/)).not.toBeInTheDocument();
    });
  });

  it("shows a skeleton that says it is checking, with no primary button yet", () => {
    assess.mockReturnValue(new Promise(() => undefined));
    sales.mockReturnValue(new Promise(() => undefined));
    open();
    expect(screen.getByRole("status", { name: "Checking this artwork" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
  });

  it("describes a record offered straight from Zoho", async () => {
    assess.mockResolvedValue(fromZoho);
    sales.mockResolvedValue(oneSale);
    open(register);
    expect(
      await screen.findByText(
        "Offer Blue room in a LAX Bid sale. It starts as a draft lot with Zoho's title, images and details.",
      ),
    ).toBeInTheDocument();
  });

  it("says why an artwork cannot move, and offers nothing to submit", async () => {
    assess.mockResolvedValue(
      blocked([{ message: "A buyer has reserved this artwork.", link: null }]),
    );
    sales.mockResolvedValue(oneSale);
    open();
    expect(await screen.findByText(/A buyer has reserved this artwork\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  it("links a reason to the place that holds the artwork, for people who can open it", async () => {
    assess.mockResolvedValue(
      blocked(
        [
          {
            message: "This artwork is in a LAX Bid sale.",
            link: { label: "Open lot in LAX Bid", target: "bid_lot" },
          },
        ],
        { holdingLotId: LOT_ID },
      ),
    );
    sales.mockResolvedValue(oneSale);
    open(register, { bidAdminUrl: "https://bid.example/admin", zohoUrl: null });
    const link = await screen.findByRole("link", { name: /Open lot in LAX Bid/ });
    expect(link).toHaveAttribute("href", `https://bid.example/admin/lots/${LOT_ID}`);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("leaves the link out for people who cannot open the place", async () => {
    assess.mockResolvedValue(
      blocked(
        [
          {
            message: "This artwork is in a LAX Bid sale.",
            link: { label: "Open lot in LAX Bid", target: "bid_lot" },
          },
        ],
        { holdingLotId: LOT_ID },
      ),
    );
    sales.mockResolvedValue(oneSale);
    open(register);
    expect(await screen.findByText(/in a LAX Bid sale/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open lot in LAX Bid/ })).not.toBeInTheDocument();
  });

  it("explains when no sale is open for new lots", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue({ ok: true, data: { connected: true, sales: [] } });
    open();
    expect(await screen.findByText("No LAX Bid sale is open for new lots")).toBeInTheDocument();
    expect(screen.getByText("Create a sale in LAX Bid first, then come back.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
  });

  it("says so when LAX Bid is not connected to LAX Admin", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue({ ok: true, data: { connected: false, sales: [] } });
    open();
    expect(
      await screen.findByText(
        "LAX Bid isn't connected to LAX Admin yet, so artworks can't be offered at auction from here.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry when LAX Bid cannot be read", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "Could not load LAX Bid sales.",
    });
    open();
    expect(await screen.findByText("Could not load LAX Bid sales.")).toBeInTheDocument();
    sales.mockResolvedValue(oneSale);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Starting price")).toBeInTheDocument();
  });

  it("offers a retry when the artwork cannot be checked", async () => {
    assess.mockRejectedValue(new Error("down"));
    sales.mockResolvedValue(oneSale);
    open(register);
    expect(
      await screen.findByText("Could not check this artwork. Try again in a moment."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("needs a sale, a price and the consignor's agreement before it sends anything", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Offer at auction" }));
    // Three problems: the summary lists them and each field shows its own. The select's
    // placeholder also reads "Choose a sale".
    expect(await screen.findByText("There are 3 problems")).toBeInTheDocument();
    expect(screen.getAllByText("Choose a sale")).toHaveLength(3);
    expect(screen.getAllByText("Enter a starting price")).toHaveLength(2);
    expect(screen.getAllByText("Confirm the consignor agreed")).toHaveLength(2);
    expect(offer).not.toHaveBeenCalled();
  });

  it("tells staff a live listing comes off lax.art", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    open();
    expect(await screen.findByText("This takes the artwork off lax.art")).toBeInTheDocument();
  });

  it("tells staff a lax.art draft stays a draft, and takes nothing off lax.art", async () => {
    assess.mockResolvedValue({
      ok: true,
      data: { ...fromZoho.data, laxArtDraft: true },
    });
    sales.mockResolvedValue(oneSale);
    open(register);
    expect(await screen.findByText("The lax.art draft stays a draft")).toBeInTheDocument();
    expect(screen.queryByText("This takes the artwork off lax.art")).not.toBeInTheDocument();
  });

  it("notes a draft lot that already exists", async () => {
    assess.mockResolvedValue({
      ok: true,
      data: { ...fromZoho.data, draftLot: { lotId: LOT_ID, saleTitle: "Winter sale" } },
    });
    sales.mockResolvedValue(oneSale);
    open(register);
    expect(await screen.findByText("This artwork already has a draft lot")).toBeInTheDocument();
    expect(screen.getByText(/Choosing that sale opens the same lot/)).toBeInTheDocument();
  });

  it("keeps what was typed when the move fails, and says what to do", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "The other product could not be reached (network). Try again in a moment.",
    });
    open();
    await fillAndSubmit();
    expect(await screen.findByText(/Try again in a moment/)).toBeInTheDocument();
    expect(screen.getByLabelText("Starting price")).toHaveValue("250");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("switches to the new reason when the artwork moved while the dialog was open", async () => {
    assess.mockResolvedValueOnce(eligible);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "This artwork is in a private sale. Withdraw it there first.",
    });
    open(register);
    assess.mockResolvedValue(
      blocked([
        { message: "This artwork is in a private sale. Withdraw it there first.", link: null },
      ]),
    );
    await fillAndSubmit();
    expect(
      await screen.findByText("This artwork can't be offered at auction yet"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Starting price")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer at auction" })).not.toBeInTheDocument();
  });

  it("creates the draft lot from a record and offers the lot to people who can open Bid admin", async () => {
    assess.mockResolvedValue(fromZoho);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: true,
      data: {
        lotId: LOT_ID,
        saleId: SALE_ID,
        saleTitle: "Winter sale",
        withdrawnFromLaxArt: false,
        created: true,
      },
    });
    open(register, { bidAdminUrl: "https://bid.example/admin", zohoUrl: null });
    await fillAndSubmit();
    await waitFor(() =>
      expect(offer).toHaveBeenCalledWith({
        target: register,
        body: { saleId: SALE_ID, startingPrice: "250.00", consignorAgreed: true },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(await screen.findByText("Draft lot created in Winter sale")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open lot in LAX Bid/ })).toHaveAttribute(
      "href",
      `https://bid.example/admin/lots/${LOT_ID}`,
    );
  });

  it("does not draw the lot link for a person who cannot open Bid admin", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: true,
      data: {
        lotId: LOT_ID,
        saleId: SALE_ID,
        saleTitle: "Winter sale",
        withdrawnFromLaxArt: true,
        created: true,
      },
    });
    open();
    await fillAndSubmit();
    expect(await screen.findByText("Draft lot created in Winter sale")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open lot in LAX Bid/ })).not.toBeInTheDocument();
  });

  it("says the lot was ready when a retry finds the one made before", async () => {
    assess.mockResolvedValue(fromZoho);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({
      ok: true,
      data: {
        lotId: LOT_ID,
        saleId: SALE_ID,
        saleTitle: "Winter sale",
        withdrawnFromLaxArt: false,
        created: false,
      },
    });
    open(register);
    await fillAndSubmit();
    expect(await screen.findByText("Draft lot ready in Winter sale")).toBeInTheDocument();
  });

  it("sends the same key on a retry, so a double click makes one lot", async () => {
    assess.mockResolvedValue(eligible);
    sales.mockResolvedValue(oneSale);
    offer.mockResolvedValue({ ok: false, kind: "failed", message: "Offering failed. Try again." });
    open();
    await fillAndSubmit();
    await screen.findByText("Offering failed. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(offer).toHaveBeenCalledTimes(2));
    const keys = offer.mock.calls.map(
      ([call]) => (call as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });
});

describe("OfferAtAuctionDialog and the consignor agreement", () => {
  const PARTY_ID = "55555555-5555-4555-8555-555555555555";
  const AGREEMENT_ID = "66666666-6666-4666-8666-666666666666";
  const withAgreement = (agreement: Record<string, unknown>) => ({
    ok: true,
    data: {
      ...eligible.data,
      consignorAgreement: {
        ...eligible.data.consignorAgreement,
        consignor: { partyId: PARTY_ID, displayName: "Example Gallery Ltd" },
        agreement: {
          id: AGREEMENT_ID,
          agreementId: AGREEMENT_ID,
          version: 1,
          places: ["lax_bid", "lax_art"],
          startsOn: "2026-03-03",
          endsOn: "2027-03-02",
          retiredOn: null,
        },
        canAddAgreement: true,
        ...agreement,
      },
    },
  });

  beforeEach(() => {
    for (const fn of [assess, sales, offer, refresh]) fn.mockReset();
    sales.mockResolvedValue(oneSale);
  });

  it("reads the agreement in force, with no checkbox, and sends no confirmation", async () => {
    assess.mockResolvedValue(
      withAgreement({ state: "in_force", outcome: "allowed", lowestPricePence: 200_000 }),
    );
    offer.mockResolvedValue({
      ok: true,
      data: {
        lotId: LOT_ID,
        saleId: SALE_ID,
        saleTitle: "Winter sale",
        withdrawnFromLaxArt: true,
        created: true,
      },
    });
    open();
    expect(
      await screen.findByText(
        `Covered by agreement with Example Gallery Ltd, signed ${formatStaffDate("2026-03-03")}, LAX Bid and lax.art, until ${formatStaffDate("2027-03-02")}.`,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /consignor agreed/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Starting price"), { target: { value: "1800" } });
    expect(screen.getByText("Below the lowest price agreed (£2,000).")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Starting price"), { target: { value: "2000" } });
    expect(screen.queryByText(/Below the lowest price agreed/)).toBeNull();

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: /Winter sale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Offer at auction" }));
    await waitFor(() => expect(offer).toHaveBeenCalled());
    expect(offer.mock.calls[0]?.[0].body).toEqual({ saleId: SALE_ID, startingPrice: "2000.00" });
  });

  it.each([
    ["none", { agreement: null }, "No agreement covers LAX Bid for Example Gallery Ltd."],
    [
      "expired",
      {
        agreement: { ...withAgreement({}).data.consignorAgreement.agreement, endsOn: "2026-10-31" },
      },
      "No agreement covers LAX Bid for Example Gallery Ltd.",
    ],
    [
      "not_started",
      {
        agreement: {
          ...withAgreement({}).data.consignorAgreement.agreement,
          startsOn: "2026-12-01",
        },
      },
      "No agreement covers LAX Bid for Example Gallery Ltd.",
    ],
    [
      "retired",
      {
        agreement: {
          ...withAgreement({}).data.consignorAgreement.agreement,
          retiredOn: "2026-10-01",
        },
      },
      "No agreement covers LAX Bid for Example Gallery Ltd.",
    ],
  ])("blocks the move when the agreement is %s, with Add agreement", async (state, over, line) => {
    assess.mockResolvedValue(withAgreement({ state, outcome: "blocked", ...over }));
    open();
    expect(await screen.findByText(line)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add agreement" }).getAttribute("href")).toBe(
      `/clients/${PARTY_ID}#agreements`,
    );
    expect(
      (screen.getByRole("button", { name: "Offer at auction" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("checkbox", { name: /consignor agreed/ })).toBeNull();
  });

  it("names no one, and offers no link, to someone who cannot read agreements", async () => {
    assess.mockResolvedValue(
      withAgreement({
        state: "none",
        outcome: "blocked",
        consignor: null,
        agreement: null,
        canAddAgreement: false,
      }),
    );
    open();
    expect(
      await screen.findByText("No agreement covers LAX Bid for this work's consignor."),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add agreement" })).toBeNull();
  });

  it("asks for the checkbox while no consignor is set, with Set consignor", async () => {
    assess.mockResolvedValue(withAgreement({ consignor: null, agreement: null }));
    open();
    expect(
      await screen.findByText(
        `No consignor is set for this work. Until ${formatStaffDate("2027-01-31")}, confirm the consignor's agreement below.`,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set consignor" }).getAttribute("href")).toBe(
      `/from-zoho/${REGISTER_ID}#consignor`,
    );
    expect(screen.getByRole("checkbox", { name: /consignor agreed/ })).toBeTruthy();
  });

  it("blocks with Set consignor once the transition is over", async () => {
    assess.mockResolvedValue(
      withAgreement({
        state: "no_consignor",
        outcome: "blocked",
        consignor: null,
        agreement: null,
      }),
    );
    open();
    expect(await screen.findByText("Set who consigned this work first.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set consignor" }).getAttribute("href")).toBe(
      `/from-zoho/${REGISTER_ID}#consignor`,
    );
    expect(
      (screen.getByRole("button", { name: "Offer at auction" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("offers Set consignor only to someone who keeps consignor agreements", async () => {
    assess.mockResolvedValue(eligible);
    open();
    await screen.findByText(/No consignor is set for this work/);
    expect(screen.queryByRole("link", { name: "Set consignor" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /consignor agreed/ })).toBeTruthy();
  });

  it("keeps pence in the lowest price when the agreement sets them", async () => {
    assess.mockResolvedValue(
      withAgreement({ state: "in_force", outcome: "allowed", lowestPricePence: 200_050 }),
    );
    open();
    fireEvent.change(await screen.findByLabelText("Starting price"), {
      target: { value: "1800" },
    });
    expect(screen.getByText("Below the lowest price agreed (£2,000.50).")).toBeTruthy();
  });

  it("shows no line when LAX owns the work", async () => {
    assess.mockResolvedValue(
      withAgreement({ state: "lax_owns", outcome: "allowed", consignor: null, agreement: null }),
    );
    open();
    await screen.findByLabelText("Starting price");
    expect(screen.queryByText(/agreement/i)).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("lists two or more problems above the form, and one problem only on its field", async () => {
    assess.mockResolvedValue(withAgreement({ state: "in_force", outcome: "allowed" }));
    open();
    await screen.findByLabelText("Starting price");
    fireEvent.click(screen.getByRole("button", { name: "Offer at auction" }));
    expect(await screen.findByText("There are 2 problems")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Starting price"), { target: { value: "250" } });
    await waitFor(() => expect(screen.queryByText("There are 2 problems")).toBeNull());
    // The one problem left shows on its field only (the placeholder reads the same).
    expect(screen.getAllByText("Choose a sale")).toHaveLength(2);
  });
});
