// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assess = vi.fn();
const offer = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/server/application/admin-offer-on-lax-art-actions.server", () => ({
  getLaxArtOfferAssessment: (...args: unknown[]) => assess(...args),
  offerOnLaxArt: (...args: unknown[]) => offer(...args),
}));
vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  searchArtistOptions: async () => [],
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { OfferOnLaxArtDialog } = await import("./offer-on-lax-art-dialog.client");

const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const ARTIST_ID = "22222222-2222-4222-8222-222222222222";
const ARTWORK_ID = "33333333-3333-4333-8333-333333333333";

const ready = {
  ok: true,
  data: {
    registerId: REGISTER_ID,
    title: "Tidal margin IV",
    stockCode: "LAX-ORI-AR-TM-26-0004",
    artistName: "Ada Rowe",
    artistCode: "AR",
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    year: 2024,
    imageCount: 3,
    missing: [],
    matchedArtist: { artistId: ARTIST_ID, displayName: "Ada Rowe" },
    existing: null,
    eligible: true,
    blockers: [],
  },
};

const withData = (patch: Record<string, unknown>) => ({
  ok: true,
  data: { ...ready.data, ...patch },
});

function open() {
  render(
    <OfferOnLaxArtDialog
      open
      onOpenChange={vi.fn()}
      registerId={REGISTER_ID}
      title="Tidal margin IV"
    />,
  );
}

describe("OfferOnLaxArtDialog", () => {
  beforeEach(() => {
    for (const fn of [assess, offer, push, toastSuccess]) fn.mockReset();
  });

  it("shows a skeleton named for the check, with no way to submit yet", () => {
    assess.mockReturnValue(new Promise(() => undefined));
    open();
    expect(screen.getByRole("status", { name: "Checking this artwork" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create lax.art draft" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows Zoho's facts read-only, marked From Zoho, with the artist matched by code", async () => {
    assess.mockResolvedValue(ready);
    open();
    expect(await screen.findByText("Oil on linen")).toBeInTheDocument();
    expect(screen.getByText("90 × 120 cm")).toBeInTheDocument();
    expect(screen.getByText("3, first is the cover")).toBeInTheDocument();
    expect(screen.getByText("From Zoho")).toBeInTheDocument();
    expect(screen.getByText("Linked to Zoho artist code AR")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Enquiries/ })).toBeChecked();
    expect(screen.getByDisplayValue("ada-rowe-tidal-margin-iv")).toBeInTheDocument();
    expect(screen.getByText("Next: the draft opens")).toBeInTheDocument();
  });

  it("says what Zoho still lacks and lets the draft be made anyway", async () => {
    assess.mockResolvedValue(
      withData({ dimensions: null, imageCount: 0, missing: ["image", "size"] }),
    );
    open();
    expect(await screen.findByText("Missing in Zoho")).toBeInTheDocument();
    expect(screen.getByText("None in Zoho")).toBeInTheDocument();
    expect(screen.getByText(/Still missing in Zoho: image, size\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create lax.art draft" })).toBeEnabled();
  });

  it("makes the draft with the choices, shows a toast and opens it", async () => {
    assess.mockResolvedValue(ready);
    offer.mockResolvedValue({
      ok: true,
      data: { artworkId: ARTWORK_ID, slug: "ada-rowe-tidal-margin-iv", created: true },
    });
    open();
    fireEvent.click(await screen.findByRole("radio", { name: /Price on application/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create lax.art draft" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/artworks/${ARTWORK_ID}?arrived=zoho`));
    expect(offer).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      body: {
        artistId: ARTIST_ID,
        saleState: "price_on_application",
        slug: "ada-rowe-tidal-margin-iv",
      },
      idempotencyKey: expect.any(String),
    });
    expect(toastSuccess).toHaveBeenCalledWith("lax.art draft created");
  });

  it("asks for the artist when none matches, in a summary and beside the field", async () => {
    assess.mockResolvedValue(withData({ matchedArtist: null }));
    open();
    await screen.findByText("Oil on linen");
    expect(
      screen.getByText(/No lax.art artist has Zoho artist code AR\. Choose one, and AR is saved/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create lax.art draft" }));
    expect(await screen.findByText("There is a problem")).toBeInTheDocument();
    expect(screen.getAllByText("Choose the lax.art artist for Ada Rowe.")).toHaveLength(2);
    expect(offer).not.toHaveBeenCalled();
  });

  it("puts a taken web address on its field and keeps what was typed", async () => {
    assess.mockResolvedValue(ready);
    offer.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "That slug is already used by another artwork.",
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Create lax.art draft" }));
    expect(
      await screen.findAllByText(
        "This web address is used by another artwork. Change it to continue.",
      ),
    ).toHaveLength(2);
    expect(screen.getByDisplayValue("ada-rowe-tidal-margin-iv")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the choices after a failure and offers Try again with the same request key", async () => {
    assess.mockResolvedValue(ready);
    offer
      .mockResolvedValueOnce({ ok: false, kind: "failed", message: "boom" })
      .mockResolvedValueOnce({
        ok: true,
        data: { artworkId: ARTWORK_ID, slug: "ada-rowe-tidal-margin-iv", created: false },
      });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Create lax.art draft" }));
    expect(
      await screen.findByText("The draft could not be created. Your choices are kept. Try again."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const keys = offer.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it("reads the record again when someone moved it while the dialog was open", async () => {
    assess.mockResolvedValueOnce(ready).mockResolvedValueOnce(
      withData({
        eligible: false,
        blockers: [
          { message: "This artwork is in a private sale. Withdraw it there first.", link: null },
        ],
      }),
    );
    offer.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This artwork is in a private sale. Withdraw it there first.",
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Create lax.art draft" }));
    expect(
      await screen.findByText("This artwork is in a private sale. Withdraw it there first."),
    ).toBeInTheDocument();
    expect(screen.getByText("This artwork can't go on lax.art yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create lax.art draft" })).not.toBeInTheDocument();
  });

  it("lists every reason an artwork cannot be offered, and offers only Close", async () => {
    assess.mockResolvedValue(
      withData({
        eligible: false,
        blockers: [
          {
            message: "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
            link: null,
          },
          {
            message:
              "Zoho shows this artwork as reserved. Offer it once Zoho shows it as available.",
            link: null,
          },
        ],
      }),
    );
    open();
    expect(await screen.findByText(/in a LAX Bid sale/)).toBeInTheDocument();
    expect(screen.getByText(/shows this artwork as reserved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create lax.art draft" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  it("offers a retry when the record cannot be checked", async () => {
    assess
      .mockResolvedValueOnce({
        ok: false,
        kind: "failed",
        message: "Could not check this artwork. Try again in a moment.",
      })
      .mockResolvedValueOnce(ready);
    open();
    expect(await screen.findByText("Could not check this artwork")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Oil on linen")).toBeInTheDocument();
  });

  it("sends staff to the draft that already exists", async () => {
    assess.mockResolvedValue(
      withData({ existing: { artworkId: ARTWORK_ID, slug: "s", published: false } }),
    );
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Open on lax.art" }));
    expect(push).toHaveBeenCalledWith(`/artworks/${ARTWORK_ID}?arrived=zoho`);
    expect(screen.queryByRole("button", { name: "Create lax.art draft" })).not.toBeInTheDocument();
  });
});
