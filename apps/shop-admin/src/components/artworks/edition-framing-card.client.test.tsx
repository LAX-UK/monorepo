// @vitest-environment jsdom
import type { AdminEditionFraming, AdminEditionFramingOption } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveEditionFraming = vi.fn();

vi.mock("@/server/application/framing-actions.server", () => ({ saveEditionFraming }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/artworks/x",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { EditionFramingCard } = await import("./edition-framing-card.client");

const option = (
  id: string,
  name: string,
  overrides: Partial<AdminEditionFramingOption> = {},
): AdminEditionFramingOption => ({
  optionId: id,
  name,
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  catalogueStatus: "active",
  placeholderBands: [],
  cataloguePricePence: 19500,
  offered: false,
  overridePence: null,
  offerable: true,
  ...overrides,
});

const ARTWORK = "00000000-0000-4000-8000-0000000000b1";
const OAK = "00000000-0000-4000-8000-0000000000a1";
const BLACK = "00000000-0000-4000-8000-0000000000a2";
const WALNUT = "00000000-0000-4000-8000-0000000000a3";
const WHITE = "00000000-0000-4000-8000-0000000000a4";

const framing: AdminEditionFraming = {
  artworkId: ARTWORK,
  mode: "unframed_or_framed",
  framedByArtist: "",
  sheetSize: "50 × 70 cm",
  band: "up_to_60x80",
  version: "2026-11-01T09:00:00.000Z",
  options: [
    option(BLACK, "Black wood frame"),
    option(OAK, "Natural oak frame", { offered: true, overridePence: 21000 }),
    option(WALNUT, "Walnut frame", { catalogueStatus: "paused", offerable: false }),
    option(WHITE, "White wood frame", {
      catalogueStatus: "draft",
      placeholderBands: ["up_to_60x80"],
      offerable: false,
    }),
  ],
};

function renderCard(
  overrides: Partial<AdminEditionFraming> = {},
  permissions = { write: true, setPrice: true },
) {
  render(
    <EditionFramingCard
      artworkId={ARTWORK}
      title="Tide line"
      framing={{ ...framing, ...overrides }}
      printPricePence={18000}
      permissions={permissions}
    />,
  );
  return screen.getByRole("form", { name: "Framing for Tide line" });
}

beforeEach(() => {
  saveEditionFraming.mockReset();
  saveEditionFraming.mockResolvedValue({ ok: true, data: framing });
});

describe("the edition Framing card", () => {
  it("names the size band and lists every catalogue option", () => {
    const form = renderCard();
    expect(
      within(form).getByText("Size band: up to 60 × 80 cm, from the 50 × 70 cm sheet"),
    ).toBeInTheDocument();
    for (const name of [
      "Black wood frame",
      "Natural oak frame",
      "Walnut frame",
      "White wood frame",
    ]) {
      expect(within(form).getByText(name)).toBeInTheDocument();
    }
    expect(within(form).getByRole("checkbox", { name: "Offer Natural oak frame" })).toBeChecked();
    expect(
      within(form).getByRole("checkbox", { name: "Offer Black wood frame" }),
    ).not.toBeChecked();
  });

  it("disables an option that cannot be offered yet, and says why", () => {
    const form = renderCard();
    const walnut = within(form).getByRole("checkbox", { name: "Offer Walnut frame" });
    expect(walnut).toBeDisabled();
    expect(within(form).getByText("Paused in the catalogue")).toBeInTheDocument();
    expect(within(form).getByRole("checkbox", { name: "Offer White wood frame" })).toBeDisabled();
    expect(
      within(form).getByText("Waiting for the framer's prices in the catalogue"),
    ).toBeInTheDocument();
  });

  it("shows what shoppers will see, and follows the form", () => {
    const form = renderCard();
    const preview = within(form).getByText("Shoppers will see").parentElement as HTMLElement;
    expect(preview).toHaveTextContent("Unframed £180.00");
    expect(preview).toHaveTextContent("Natural oak frame +£210.00 (edition price)");
    fireEvent.click(within(form).getByRole("checkbox", { name: "Offer Black wood frame" }));
    expect(preview).toHaveTextContent("Black wood frame +£195.00");
  });

  it("asks for an edition price only from staff who may set prices", () => {
    const withPrice = renderCard();
    expect(
      within(withPrice).getByLabelText(/Price for this edition: Natural oak frame/),
    ).toBeInTheDocument();
  });

  it("shows the edition price as text to staff who may not set prices", () => {
    const form = renderCard({}, { write: true, setPrice: false });
    expect(within(form).queryByLabelText(/Price for this edition/)).not.toBeInTheDocument();
    expect(within(form).getByText("£210.00 (edition price)")).toBeInTheDocument();
  });

  it("saves the offered options and the edition's price, from the version it opened", async () => {
    const form = renderCard();
    fireEvent.click(within(form).getByRole("checkbox", { name: "Offer Black wood frame" }));
    fireEvent.change(within(form).getByLabelText(/Price for this edition: Natural oak frame/), {
      target: { value: "205" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save framing" }));

    await waitFor(() => expect(saveEditionFraming).toHaveBeenCalledTimes(1));
    expect(saveEditionFraming).toHaveBeenCalledWith({
      artworkId: ARTWORK,
      body: {
        mode: "unframed_or_framed",
        framedByArtist: "",
        offers: [
          { optionId: BLACK, overridePence: null },
          { optionId: OAK, overridePence: 20500 },
        ],
        expectedVersion: "2026-11-01T09:00:00.000Z",
      },
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("keeps Save disabled until something changes, and Discard puts it back", () => {
    const form = renderCard();
    expect(within(form).getByRole("button", { name: "Saved" })).toBeDisabled();
    fireEvent.click(within(form).getByRole("checkbox", { name: "Offer Black wood frame" }));
    expect(within(form).getByRole("button", { name: "Save framing" })).toBeEnabled();
    fireEvent.click(within(form).getByRole("button", { name: "Discard changes" }));
    expect(
      within(form).getByRole("checkbox", { name: "Offer Black wood frame" }),
    ).not.toBeChecked();
  });

  it("will not save framed-only with no option, and says so in a summary and on the form", async () => {
    const form = renderCard();
    fireEvent.click(within(form).getByRole("radio", { name: /Framed only/ }));
    fireEvent.click(within(form).getByRole("checkbox", { name: "Offer Natural oak frame" }));
    fireEvent.click(within(form).getByRole("button", { name: "Save framing" }));
    const summary = await within(form).findByRole("alert");
    expect(summary).toHaveTextContent(
      "Offer at least one option, or sell this edition another way",
    );
    expect(saveEditionFraming).not.toHaveBeenCalled();
  });

  it("swaps the options for a description when the print comes framed by the artist", async () => {
    const form = renderCard();
    fireEvent.click(within(form).getByRole("radio", { name: /Comes framed by the artist/ }));
    expect(within(form).queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Save framing" }));
    expect(await within(form).findAllByText("Describe the artist's frame")).not.toHaveLength(0);

    fireEvent.change(within(form).getByLabelText("The artist's frame"), {
      target: { value: "Oak frame made by the artist" },
    });
    expect(
      within(form).getByText("Comes framed: Oak frame made by the artist"),
    ).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Save framing" }));
    await waitFor(() => expect(saveEditionFraming).toHaveBeenCalledTimes(1));
    expect(saveEditionFraming.mock.calls[0]?.[0].body).toMatchObject({
      mode: "framed_by_artist",
      framedByArtist: "Oak frame made by the artist",
      offers: [],
    });
  });

  it("explains a missing sheet size instead of offering options that cannot be priced", async () => {
    const form = renderCard({ band: null, sheetSize: null });
    expect(within(form).getByText("No size band yet")).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("checkbox", { name: "Offer Black wood frame" }));
    fireEvent.click(within(form).getByRole("button", { name: "Save framing" }));
    expect(
      (await within(form).findAllByText(/Add the sheet size, up to 80 × 100 cm/)).length,
    ).toBeGreaterThan(0);
  });

  it("says a sheet size that could not be read apart from one that is too large", () => {
    const unreadable = renderCard({ band: null, sheetSize: "A2" });
    expect(within(unreadable).getByText("Sheet size not read")).toBeInTheDocument();
    expect(
      within(unreadable).getAllByText(
        "We could not read the sheet size. Write it as 50 × 70 cm on the Edition card.",
      ).length,
    ).toBeGreaterThan(0);
    cleanup();
    const tooLarge = renderCard({ band: null, sheetSize: "90 × 120 cm" });
    expect(within(tooLarge).getByText("No size band yet")).toBeInTheDocument();
    expect(
      within(tooLarge).getByText(/larger than 80 × 100 cm, so no options can be offered/),
    ).toBeInTheDocument();
  });

  it("says a size with no unit is read as cm", () => {
    const form = renderCard({ sheetSize: "50 × 70" });
    expect(within(form).getByText(/Read as cm/)).toBeInTheDocument();
  });

  it("stays as it was and says so when someone else saved first", async () => {
    saveEditionFraming.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This edition's framing was changed by someone else since it was opened",
      currentVersion: "2026-11-02T09:00:00.000Z",
    });
    const form = renderCard();
    fireEvent.click(within(form).getByRole("checkbox", { name: "Offer Black wood frame" }));
    fireEvent.click(within(form).getByRole("button", { name: "Save framing" }));
    expect(
      await within(form).findByText(/Someone else changed this edition's framing/),
    ).toBeInTheDocument();
  });

  it("is view only without catalogue edit rights", () => {
    const form = renderCard({}, { write: false, setPrice: false });
    expect(within(form).getByText("View only")).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Save framing" })).not.toBeInTheDocument();
    expect(within(form).getByRole("checkbox", { name: "Offer Black wood frame" })).toBeDisabled();
    expect(within(form).getByRole("radio", { name: /Framed only/ })).toBeDisabled();
  });

  it("points to the catalogue when it has no options", () => {
    const form = renderCard({ options: [] });
    expect(within(form).getByText("No framing options in the catalogue yet")).toBeInTheDocument();
  });
});
