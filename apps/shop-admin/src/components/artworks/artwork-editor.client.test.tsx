// @vitest-environment jsdom
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createArtwork = vi.fn();
const saveArtwork = vi.fn();
const saveArtworkPrice = vi.fn();
const setArtworkVisibility = vi.fn();
const getArtworkDetail = vi.fn();
const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const createPrintsFromOriginal = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  createArtwork,
  saveArtwork,
  saveArtworkPrice,
  setArtworkVisibility,
  getArtworkDetail,
  searchArtistOptions: vi.fn(async () => []),
  searchOriginalArtworkOptions: vi.fn(async () => []),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  usePathname: () => "/artworks/a-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError, warning: vi.fn() }),
  Toaster: () => null,
}));

// Radix dialogs, popovers, menus, selects and tooltips run positioning and focus loops jsdom
// cannot settle. These stand-ins keep their open and choose contracts, so the editor's own
// behaviour is what is tested.
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));
vi.mock("@auction/ui/components/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: () => null,
    DropdownMenuItem: Pass,
    DropdownMenuCheckboxItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => null,
    DropdownMenuRadioGroup: Pass,
    DropdownMenuRadioItem: Pass,
  };
});
vi.mock("@auction/ui/components/radio-group", async () => {
  const { createContext, useContext } = await import("react");
  const Group = createContext<{
    value?: string | undefined;
    onValueChange?: ((value: string) => void) | undefined;
  }>({});
  return {
    RadioGroup: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <Group.Provider value={{ value, onValueChange }}>
        <div role="radiogroup">{children}</div>
      </Group.Provider>
    ),
    RadioGroupItem: function RadioGroupItem({
      id,
      value,
      disabled,
    }: {
      id?: string;
      value: string;
      disabled?: boolean;
    }) {
      const group = useContext(Group);
      return (
        <input
          type="radio"
          id={id}
          value={value}
          disabled={disabled}
          checked={group.value === value}
          onChange={() => group.onValueChange?.(value)}
        />
      );
    },
  };
});
vi.mock("@auction/ui/components/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    disabled,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked === true}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));
vi.mock("@/server/application/admin-zoho-link-actions.server", () => ({
  searchZohoRecords: vi.fn(async () => ({ ok: true, data: { items: [], more: false } })),
  getZohoLinkPreview: vi.fn(),
  linkToZoho: vi.fn(),
  unlinkFromZoho: vi.fn(),
}));
vi.mock("@/server/application/edition-run-actions.server", () => ({
  saveEditionRun: vi.fn(),
  saveEditionFacts: vi.fn(),
  correctEditionFacts: vi.fn(),
  setEditionFactsForRuns: vi.fn(),
  addOpenEditionStock: vi.fn(),
  createProofListing: vi.fn(),
  createCompanionListing: vi.fn(),
  createPrintsFromOriginal,
}));
vi.mock("@auction/ui/components/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <div id={id}>{children}</div>
  ),
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

const { ArtworkEditor } = await import("./artwork-editor.client");

const ARTIST = "22222222-2222-4222-8222-222222222222";
const OPENED = "2026-03-01T10:00:00.000Z";
const THEIRS = "2026-03-01T11:30:00.000Z";

const detail: AdminArtworkDetail = {
  artworkId: "11111111-1111-4111-8111-111111111111",
  slug: "harbour-at-dusk",
  title: "Harbour at Dusk",
  artist: { artistId: ARTIST, slug: "ada-artist", displayName: "Ada Artist", archived: false },
  yearCreated: 2024,
  medium: "Oil on linen",
  dimensions: null,
  description: null,
  run: {
    spec: { type: "lax_standard" },
    proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
    locks: { sizeAndAllocationLocked: false, factsLocked: false },
    facts: null,
    factsConfirmed: null,
    factsVersion: null,
    paidOrderCount: 0,
    affectedOrders: [],
    mainRun: null,
    linkedListings: [],
    stock: null,
    prints: null,
    setApart: null,
    certificateAuthority: null,
    horsCommerce: null,
  },
  printPricePence: 45_000,
  saleState: "for_sale",
  salesChannel: "shop",
  seoTitle: null,
  seoDescription: null,
  images: [],
  importedImageUrl: null,
  editions: {
    size: 24,
    committed: 3,
    byStatus: { not_authorised: 12, authorised: 9, reserved: 1, held: 0, sold: 2, withdrawn: 0 },
    byAllocation: { original_buyer_entitlement: 10, artist: 10, lax: 4 },
  },
  state: "draft",
  publishBlockers: ["no_image"],
  publishedAt: null,
  archivedAt: null,
  createdAt: OPENED,
  updatedAt: OPENED,
  version: OPENED,
};

const admin = { write: true, setPrice: true, correctFacts: false, approveHorsCommerce: false };

function renderEditor(props: Partial<React.ComponentProps<typeof ArtworkEditor>> = {}) {
  return render(
    <ArtworkEditor detail={detail} permissions={admin} currentYear={2026} {...props} />,
  );
}

function typeInto(label: string | RegExp, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.input(input, { target: { value } });
  fireEvent.change(input, { target: { value } });
}

function typeIntoId(id: string, value: string) {
  const input = document.getElementById(id) as HTMLElement;
  fireEvent.input(input, { target: { value } });
  fireEvent.change(input, { target: { value } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("artwork editor", () => {
  beforeEach(() => {
    for (const mock of [
      createArtwork,
      saveArtwork,
      saveArtworkPrice,
      setArtworkVisibility,
      getArtworkDetail,
      push,
      replace,
      refresh,
      createPrintsFromOriginal,
      toastSuccess,
      toastError,
    ]) {
      mock.mockReset();
    }
    window.history.replaceState(null, "", "/artworks/a-1");
  });

  describe("layout", () => {
    it("draws one divider above the actions: the last section's, not a second rule", () => {
      renderEditor({ detail: null });
      const form = screen.getByRole("form", { name: "New artwork" });
      const cancel = within(form).getByRole("link", { name: "Cancel" });
      const actions = cancel.parentElement?.parentElement as HTMLElement;
      expect(actions.className).not.toContain("border-t");
      expect(actions.previousElementSibling?.className).toContain("border-b");
    });
  });

  describe("validation", () => {
    it("shows each problem beside its field and in a linked summary", () => {
      renderEditor({ detail: null });
      fireEvent.click(document.getElementById("artwork-kind-original") as HTMLElement);
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);

      const summary = screen.getByRole("alert");
      expect(
        within(summary).getByRole("link", { name: "Enter the artwork's title." }),
      ).toHaveAttribute("href", "#artwork-title");
      expect(within(summary).getByRole("link", { name: "Choose the artist." })).toHaveAttribute(
        "href",
        "#artwork-artistId",
      );
      expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
      expect(createArtwork).not.toHaveBeenCalled();
    });

    it("refuses a zero price in pounds", () => {
      renderEditor();
      typeInto(/Price per edition/, "0");
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);
      expect(screen.getAllByText("The price must be more than £0.").length).toBeGreaterThan(0);
      expect(saveArtwork).not.toHaveBeenCalled();
    });

    it("clears an error as soon as the field is fixed", () => {
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      fireEvent.click(document.getElementById("artwork-kind-original") as HTMLElement);
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);
      expect(screen.getAllByText("Enter the artwork's title.").length).toBe(2);
      typeInto("Title", "Harbour at Dusk");
      expect(screen.queryByText("Enter the artwork's title.")).toBeNull();
    });
  });

  describe("creating", () => {
    /** The LAX standard run's facts: unsigned, unnumbered and with no certificate. */
    function chooseFacts() {
      fireEvent.click(screen.getByLabelText("Not signed"));
      fireEvent.click(screen.getByLabelText("Not numbered"));
      fireEvent.click(screen.getByLabelText("No certificate"));
    }

    it("creates prints in pence with the LAX standard run and its facts, then opens them", async () => {
      createArtwork.mockResolvedValue({
        ok: true,
        data: { artworkId: detail.artworkId, slug: "harbour-at-dusk", version: OPENED },
      });
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      expect(screen.getByLabelText(/^LAX standard/)).toBeChecked();
      typeInto("Title", "Harbour at Dusk");
      typeInto(/Price per edition/, "1,250.50");
      expect(screen.getByLabelText(/Web address/)).toHaveValue("harbour-at-dusk");
      chooseFacts();
      expect(screen.getAllByText("Shoppers will see").length).toBeGreaterThan(0);
      fireEvent.click(screen.getByLabelText(/I have checked these facts/));
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);

      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/artworks/${detail.artworkId}`));
      expect(createArtwork.mock.calls[0]?.[0].body).toMatchObject({
        title: "Harbour at Dusk",
        slug: "harbour-at-dusk",
        artistId: ARTIST,
        printPricePence: 125_050,
        run: {
          spec: { type: "lax_standard" },
          facts: {
            numbering: "none",
            signature: { kind: "unsigned" },
            certificate: { kind: "none" },
          },
          factsConfirmed: true,
        },
      });
      expect(toastSuccess).toHaveBeenCalledWith("Created “Harbour at Dusk” as a draft");
    });

    it("puts the run first and checks it on submit, with the staff wording", () => {
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      fireEvent.click(screen.getByLabelText(/^Custom limited edition/));
      typeInto("Size", "24");
      typeIntoId("run-allocation-buyer", "6");
      typeIntoId("run-allocation-artist", "12");
      typeIntoId("run-allocation-lax", "4");
      expect(screen.getByText("22 of 24 allocated: 2 left")).toBeInTheDocument();
      const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(headings.indexOf("Run")).toBe(headings.indexOf("What are you adding?") + 1);
      expect(headings.indexOf("Edition facts")).toBe(headings.indexOf("Run") + 1);
      expect(headings.at(-1)).toBe("Confirm");
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);
      const summary = screen.getByRole("alert");
      expect(
        within(summary).getByRole("link", { name: "Allocate every print: 2 are not allocated" }),
      ).toBeInTheDocument();
      expect(
        within(summary).getByRole("link", {
          name: "Buyer prints need an original on lax.art. Link the original or set buyers to 0",
        }),
      ).toBeInTheDocument();
      expect(
        within(summary).getByRole("link", { name: "Choose how the prints are signed" }),
      ).toBeInTheDocument();
      expect(createArtwork).not.toHaveBeenCalled();
      typeIntoId("run-allocation-buyer", "0");
      typeIntoId("run-allocation-artist", "20");
      expect(screen.getByText("24 of 24 allocated")).toBeInTheDocument();
      expect(
        screen.getByText("Prints 1–20 go to the artist and 21–24 to LAX."),
      ).toBeInTheDocument();
    });

    it("shows a taken slug on the slug field", async () => {
      createArtwork.mockResolvedValue({
        ok: false,
        kind: "conflict",
        message: "That slug is already used by another artwork.",
      });
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      typeInto("Title", "Harbour at Dusk");
      chooseFacts();
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);
      await waitFor(() =>
        expect(screen.getByLabelText(/Web address/)).toHaveAttribute("aria-invalid", "true"),
      );
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("creating an original with its prints", () => {
    const PRINTS = "33333333-3333-4333-8333-333333333333";

    function startOriginal() {
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      fireEvent.click(document.getElementById("artwork-kind-original") as HTMLElement);
      typeInto("Title", "Harbour at Dusk");
    }

    it("offers prints for an original only, off by default", () => {
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      expect(screen.queryByLabelText(/^Also create prints of this original/)).toBeNull();
      fireEvent.click(document.getElementById("artwork-kind-original") as HTMLElement);
      expect(screen.getByLabelText(/^Also create prints of this original/)).not.toBeChecked();
      expect(screen.queryByLabelText("Shop title")).toBeNull();
      expect(screen.getAllByRole("button", { name: "Create draft" }).length).toBeGreaterThan(0);
    });

    it("opens the LAX standard run with the original's title and names the button by the count", () => {
      startOriginal();
      fireEvent.click(screen.getByLabelText(/^Also create prints of this original/));
      expect(screen.getByLabelText("Shop title")).toHaveValue("Harbour at Dusk");
      expect(screen.getByLabelText(/^LAX standard/)).toBeChecked();
      expect(
        screen.getAllByRole("button", { name: "Create original and 24 prints" }).length,
      ).toBeGreaterThan(0);
      typeInto("Title", "Harbour at Dusk II");
      expect(screen.getByLabelText("Shop title")).toHaveValue("Harbour at Dusk II");
      typeInto("Shop title", "Harbour, signed prints");
      typeInto("Title", "Harbour at Dusk III");
      expect(screen.getByLabelText("Shop title")).toHaveValue("Harbour, signed prints");
    });

    it("saves the original and its prints in one request, then opens the original", async () => {
      createArtwork.mockResolvedValue({
        ok: true,
        data: {
          artworkId: detail.artworkId,
          slug: "harbour-at-dusk",
          version: OPENED,
          prints: {
            artworkId: PRINTS,
            slug: "harbour-at-dusk-prints",
            version: OPENED,
            editionCount: 24,
          },
        },
      });
      startOriginal();
      fireEvent.click(screen.getByLabelText(/^Also create prints of this original/));
      fireEvent.click(
        screen.getAllByRole("button", { name: "Create original and 24 prints" })[0] as HTMLElement,
      );
      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/artworks/${detail.artworkId}`));
      expect(createArtwork).toHaveBeenCalledTimes(1);
      expect(createArtwork.mock.calls[0]?.[0].body).toMatchObject({
        run: null,
        salesChannel: "art",
        prints: {
          title: "Harbour at Dusk",
          run: { spec: { type: "lax_standard" } },
        },
      });
      expect(toastSuccess).toHaveBeenCalledWith(
        "Created “Harbour at Dusk” and 24 prints as drafts",
      );
    });

    it("sends no prints when the section stays off", async () => {
      createArtwork.mockResolvedValue({
        ok: true,
        data: { artworkId: detail.artworkId, slug: "harbour-at-dusk", version: OPENED },
      });
      startOriginal();
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(createArtwork.mock.calls[0]?.[0].body).not.toHaveProperty("prints");
    });

    it("checks the prints with the rest and creates nothing while they are wrong", () => {
      startOriginal();
      fireEvent.click(screen.getByLabelText(/^Also create prints of this original/));
      fireEvent.click(screen.getByLabelText(/^Custom limited edition/));
      typeInto("Size", "24");
      typeIntoId("run-allocation-buyer", "6");
      typeIntoId("run-allocation-artist", "12");
      typeIntoId("run-allocation-lax", "4");
      typeInto("Shop title", "   ");
      fireEvent.click(
        screen.getAllByRole("button", { name: /^Create original and/ })[0] as HTMLElement,
      );
      const summary = screen.getByRole("alert");
      expect(
        within(summary).getByRole("link", { name: "Enter a title for the prints" }),
      ).toHaveAttribute("href", "#original-prints-title");
      expect(
        within(summary).getByRole("link", { name: "Allocate every print: 2 are not allocated" }),
      ).toBeInTheDocument();
      expect(createArtwork).not.toHaveBeenCalled();
    });

    it("keeps everything on screen when the save is refused, and says nothing was created", async () => {
      createArtwork.mockResolvedValue({ ok: false, kind: "failed", message: "Save failed." });
      startOriginal();
      fireEvent.click(screen.getByLabelText(/^Also create prints of this original/));
      fireEvent.click(
        screen.getAllByRole("button", { name: "Create original and 24 prints" })[0] as HTMLElement,
      );
      await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nothing was created"));
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Shop title")).toHaveValue("Harbour at Dusk");
    });
  });

  describe("creating prints from a saved original", () => {
    const original: AdminArtworkDetail = {
      ...detail,
      run: null,
      printPricePence: null,
      saleState: "price_on_application",
      salesChannel: "art",
      editions: {
        size: 0,
        committed: 0,
        byStatus: { not_authorised: 0, authorised: 0, reserved: 0, held: 0, sold: 0, withdrawn: 0 },
        byAllocation: { original_buyer_entitlement: 0, artist: 0, lax: 0 },
      },
      linkedPrints: [],
    };
    const existing = {
      artworkId: "44444444-4444-4444-8444-444444444444",
      slug: "harbour-at-dusk-prints",
      title: "Harbour at Dusk, prints",
      state: "draft" as const,
      size: 24,
    };

    it("explains the empty list and opens the dialog with the standard run", () => {
      renderEditor({ detail: original });
      expect(screen.getByText("No prints yet")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Create prints" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByLabelText("Shop title")).toHaveValue("Harbour at Dusk");
      expect(within(dialog).getByLabelText(/^LAX standard/)).toBeChecked();
      expect(within(dialog).getByRole("button", { name: "Create 24 prints" })).toBeInTheDocument();
      expect(within(dialog).queryByText(/already has/)).toBeNull();
    });

    it("creates the prints, then reads the original again so they are listed", async () => {
      createPrintsFromOriginal.mockResolvedValue({
        ok: true,
        data: {
          artworkId: existing.artworkId,
          slug: existing.slug,
          version: OPENED,
          editionCount: 24,
        },
      });
      getArtworkDetail.mockResolvedValue({
        ok: true,
        data: { ...original, linkedPrints: [existing] },
      });
      renderEditor({ detail: original });
      fireEvent.click(screen.getByRole("button", { name: "Create prints" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Create 24 prints" }),
      );
      await waitFor(() => expect(createPrintsFromOriginal).toHaveBeenCalledTimes(1));
      expect(createPrintsFromOriginal.mock.calls[0]?.[0]).toMatchObject({
        artworkId: original.artworkId,
        body: { title: "Harbour at Dusk", run: { spec: { type: "lax_standard" } } },
      });
      await waitFor(() =>
        expect(
          screen.getAllByRole("link", { name: "Harbour at Dusk, prints" }).length,
        ).toBeGreaterThan(0),
      );
      expect(toastSuccess).toHaveBeenCalledWith("Created 24 prints as a draft", expect.anything());
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("lists the prints already linked before a second set is made", () => {
      renderEditor({ detail: { ...original, linkedPrints: [existing] } });
      fireEvent.click(screen.getAllByRole("button", { name: "Create prints" })[0] as HTMLElement);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("This original already has prints")).toBeInTheDocument();
      expect(within(dialog).getByRole("link", { name: "Harbour at Dusk, prints" })).toHaveAttribute(
        "href",
        `/artworks/${existing.artworkId}`,
      );
      expect(within(dialog).getByText(/adds another listing/)).toBeInTheDocument();
    });

    it("shows a refusal inside the dialog and keeps it open", async () => {
      createPrintsFromOriginal.mockResolvedValue({
        ok: false,
        kind: "conflict",
        message: "The original is archived; restore it before creating prints",
      });
      renderEditor({ detail: original });
      fireEvent.click(screen.getByRole("button", { name: "Create prints" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Create 24 prints" }),
      );
      await waitFor(() =>
        expect(
          within(screen.getByRole("dialog")).getByText(/restore it before creating prints/),
        ).toBeInTheDocument(),
      );
    });

    it("checks the run before sending anything", () => {
      renderEditor({ detail: original });
      fireEvent.click(screen.getByRole("button", { name: "Create prints" }));
      const dialog = screen.getByRole("dialog");
      typeInto("Shop title", "");
      fireEvent.click(within(dialog).getByRole("button", { name: "Create 24 prints" }));
      expect(within(dialog).getByText("Enter a title for the prints")).toBeInTheDocument();
      expect(createPrintsFromOriginal).not.toHaveBeenCalled();
    });

    it("offers no way to create prints from an archived original or without catalogue access", () => {
      const { unmount } = renderEditor({
        detail: { ...original, state: "archived", archivedAt: OPENED },
      });
      expect(screen.queryByRole("button", { name: "Create prints" })).toBeNull();
      expect(screen.getByText(/Restore it to create prints/)).toBeInTheDocument();
      unmount();
      renderEditor({ detail: original, permissions: { ...admin, write: false } });
      expect(screen.queryByRole("button", { name: "Create prints" })).toBeNull();
    });
  });

  describe("saving", () => {
    it("reads as saved at once, then confirms with a toast", async () => {
      const pending = deferred<unknown>();
      saveArtwork.mockReturnValue(pending.promise);
      renderEditor();
      typeInto("Title", "Harbour at Dawn");
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);

      expect(screen.getAllByRole("button", { name: "Saved" }).length).toBeGreaterThan(0);
      expect(saveArtwork).toHaveBeenCalledWith(
        expect.objectContaining({
          artworkId: detail.artworkId,
          expectedVersion: OPENED,
          body: expect.objectContaining({ title: "Harbour at Dawn", printPricePence: 45_000 }),
        }),
      );
      pending.resolve({ ok: true, data: { version: THEIRS } });
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Changes saved"));
      expect(refresh).toHaveBeenCalled();
    });

    it("shows the linked original and saves the link removed", async () => {
      const ORIGINAL = "33333333-3333-4333-8333-333333333333";
      saveArtwork.mockResolvedValue({ ok: true, data: { version: THEIRS } });
      renderEditor({
        detail: {
          ...detail,
          sourceOriginal: {
            artworkId: ORIGINAL,
            slug: "harbour-original",
            title: "Harbour, original",
          },
        },
      });
      expect(screen.getByText("Harbour, original")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);
      await waitFor(() =>
        expect(saveArtwork).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({ sourceOriginalArtworkId: null }),
          }),
        ),
      );
    });

    it("puts the edits back as unsaved when the save is refused", async () => {
      saveArtwork.mockResolvedValue({ ok: false, kind: "failed", message: "Shop API is down." });
      renderEditor();
      typeInto("Title", "Harbour at Dawn");
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);

      await waitFor(() => expect(screen.getByText("Shop API is down.")).toBeInTheDocument());
      expect(screen.getAllByRole("button", { name: "Save changes" }).length).toBeGreaterThan(0);
      expect(screen.getByLabelText("Title")).toHaveValue("Harbour at Dawn");
      expect(toastError).toHaveBeenCalledWith("Your changes were not saved");
    });

    it("offers to load the other version or save over it after a conflict", async () => {
      saveArtwork
        .mockResolvedValueOnce({
          ok: false,
          kind: "conflict",
          message: "This artwork was changed by someone else since it was opened",
          currentVersion: THEIRS,
        })
        .mockResolvedValueOnce({ ok: true, data: { version: "2026-03-01T12:00:00.000Z" } });
      renderEditor();
      typeInto("Title", "Harbour at Dawn");
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);

      const notice = await screen.findByText("Someone else saved this artwork after you opened it");
      expect(notice).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Save mine over it" }));
      await waitFor(() => expect(saveArtwork).toHaveBeenCalledTimes(2));
      expect(saveArtwork.mock.calls[1]?.[0].expectedVersion).toBe(THEIRS);
    });

    it("keeps the price read-only, and unchanged, without price access", async () => {
      saveArtwork.mockResolvedValue({ ok: true, data: { version: THEIRS } });
      renderEditor({
        permissions: {
          write: true,
          setPrice: false,
          correctFacts: false,
          approveHorsCommerce: false,
        },
      });
      const price = screen.getByLabelText(/Price per edition/);
      expect(price).toHaveAttribute("readonly");
      expect(
        screen.getByText("Only a shop admin can set or change the price."),
      ).toBeInTheDocument();
      typeInto("Title", "Harbour at Dawn");
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);
      await waitFor(() => expect(saveArtwork).toHaveBeenCalled());
      expect(saveArtwork.mock.calls[0]?.[0].body.printPricePence).toBe(45_000);
    });
  });

  describe("leaving", () => {
    it("asks before leaving with unsaved edits, and leaves when told to", async () => {
      renderEditor();
      typeInto("Title", "Harbour at Dawn");
      fireEvent.click(screen.getByRole("link", { name: "Artworks" }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/^Discard changes to “.+”\?$/)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Discard changes" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/artworks"));
    });

    it("lets staff leave a page with nothing unsaved", () => {
      renderEditor();
      // jsdom cannot navigate; stop the link after the guard has had its chance to hold it.
      const stop = (event: MouseEvent) => event.preventDefault();
      document.addEventListener("click", stop);
      fireEvent.click(screen.getByRole("link", { name: "Artworks" }));
      document.removeEventListener("click", stop);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("editions and visibility", () => {
    it("shows staff the run's counts and why it cannot be published yet", () => {
      renderEditor();
      expect(screen.getByLabelText("Edition counts")).toHaveTextContent("Sold2");
      expect(screen.getAllByText("Not ready to publish").length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    });

    it("unpublishes a live artwork after confirming", async () => {
      setArtworkVisibility.mockResolvedValue({
        ok: true,
        data: { version: THEIRS, state: "draft" },
      });
      renderEditor({
        detail: { ...detail, state: "live", publishBlockers: [], publishedAt: OPENED },
      });
      fireEvent.click(screen.getAllByRole("button", { name: "Unpublish" })[0] as HTMLElement);
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Unpublish" }));
      await waitFor(() =>
        expect(setArtworkVisibility).toHaveBeenCalledWith(
          expect.objectContaining({ artworkId: detail.artworkId, action: "unpublish" }),
        ),
      );
      expect(toastSuccess).toHaveBeenCalledWith("Unpublished “Harbour at Dusk”");
    });

    it("waits for unsaved edits before changing visibility", () => {
      renderEditor({
        detail: { ...detail, state: "live", publishBlockers: [], publishedAt: OPENED },
      });
      typeInto("Title", "Harbour at Dawn");
      for (const button of screen.getAllByRole("button", { name: "Unpublish" })) {
        expect(button).toBeDisabled();
      }
    });
  });

  it("is read-only for staff who cannot change the catalogue", () => {
    renderEditor({
      permissions: {
        write: false,
        setPrice: false,
        correctFacts: false,
        approveHorsCommerce: false,
      },
    });
    expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
    expect(screen.getByText("Oil on linen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("lets finance change only the price, through the price endpoint", async () => {
    saveArtworkPrice.mockResolvedValue({ ok: true, data: { version: THEIRS } });
    renderEditor({
      permissions: {
        write: false,
        setPrice: true,
        correctFacts: false,
        approveHorsCommerce: false,
      },
    });
    expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
    expect(screen.getByText("Oil on linen")).toBeInTheDocument();
    expect(screen.getByText("You can change the edition price")).toBeInTheDocument();
    typeInto(/Price per edition/, "520");
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);
    await waitFor(() =>
      expect(saveArtworkPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          artworkId: detail.artworkId,
          printPricePence: 52_000,
          expectedVersion: OPENED,
        }),
      ),
    );
    expect(saveArtwork).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
  });
});

describe("a lax.art original made from a Zoho record", () => {
  const linked: AdminArtworkDetail = {
    ...detail,
    run: null,
    salesChannel: "art",
    printPricePence: null,
    dimensions: null,
    editions: {
      size: 0,
      committed: 0,
      byStatus: { not_authorised: 0, authorised: 0, reserved: 0, held: 0, sold: 0, withdrawn: 0 },
      byAllocation: { original_buyer_entitlement: 0, artist: 0, lax: 0 },
    },
    publishBlockers: ["no_zoho_image", "no_size"],
    zohoLink: {
      registerId: "33333333-3333-4333-8333-333333333333",
      zohoProductId: "1023341000017963004",
      stockCode: "LAX-ORI-AR-TM-26-0004",
      zohoStatus: "Available",
      whereItIs: {
        key: "draft_lax_art",
        chip: { label: "Draft on lax.art", tone: "info", marker: "hollow" },
        from: null,
        since: null,
        bidLot: null,
      },
      recentMoves: [],
    },
  };

  beforeEach(() => {
    window.history.replaceState(null, "", "/artworks/a-1");
  });

  it("marks the details Zoho owns, and leaves only LAX's own fields to type into", () => {
    renderEditor({ detail: linked, zohoUrl: "https://crm.example/Products/1" });
    expect(screen.getAllByText("From Zoho").length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText("Harbour at Dusk").length).toBeGreaterThan(1);
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByLabelText(/Medium/)).toBeNull();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Edit in Zoho/ })[0]).toHaveAttribute(
      "href",
      "https://crm.example/Products/1",
    );
  });

  it("says size is not in Zoho yet instead of leaving a blank", () => {
    renderEditor({ detail: linked });
    expect(screen.getByText("Not in Zoho yet")).toBeInTheDocument();
  });

  it("shows where it is in the rail, with the record behind it", () => {
    renderEditor({ detail: linked });
    const rail = screen.getByRole("complementary", { name: "Where it is" });
    expect(within(rail).getAllByText("Draft on lax.art").length).toBeGreaterThan(0);
    expect(within(rail).getByText("LAX-ORI-AR-TM-26-0004")).toBeInTheDocument();
    expect(within(rail).getByRole("link", { name: "From Zoho record" })).toHaveAttribute(
      "href",
      "/from-zoho/33333333-3333-4333-8333-333333333333",
    );
  });

  it("names what Zoho lacks before publishing, with a way to fix it", () => {
    renderEditor({ detail: linked, zohoUrl: "https://crm.example/Products/1" });
    const notice = screen.getByText("Not ready to publish").closest("[role=status]") as HTMLElement;
    expect(notice).toHaveTextContent("Zoho has no image for this artwork. Add one in Zoho.");
    expect(notice).toHaveTextContent("Zoho has no size for this artwork. Add it in Zoho.");
    expect(within(notice).getByRole("link", { name: /Edit in Zoho/ })).toBeInTheDocument();
  });

  it("tells staff what to do next on arrival, and lets them dismiss it", () => {
    renderEditor({ detail: linked, arrivedFromZoho: true });
    expect(screen.getByText("Draft created from Zoho")).toBeInTheDocument();
    expect(
      screen.getByText("Write the description, check the images, then publish."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Draft created from Zoho")).toBeNull();
  });

  it("does not show the arrival notice on an ordinary visit", () => {
    renderEditor({ detail: linked });
    expect(screen.queryByText("Draft created from Zoho")).toBeNull();
  });

  it("shows the images as Zoho's, with no upload", () => {
    renderEditor({ detail: linked });
    expect(screen.getByText("No images in Zoho yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add or reorder images in Zoho. They arrive here by themselves."),
    ).toBeInTheDocument();
  });

  it("marks what Zoho owns for a view-only person too", () => {
    renderEditor({
      detail: linked,
      permissions: {
        write: false,
        setPrice: false,
        correctFacts: false,
        approveHorsCommerce: false,
      },
    });
    expect(screen.getAllByText("From Zoho")).toHaveLength(5);
  });

  it("shows no Zoho marks in the view-only details of an unlinked original", () => {
    renderEditor({
      detail: { ...linked, zohoLink: null },
      permissions: {
        write: false,
        setPrice: false,
        correctFacts: false,
        approveHorsCommerce: false,
      },
    });
    expect(screen.queryByText("From Zoho")).toBeNull();
  });

  it("keeps an unlinked original editable, with Where it is saying nothing of Zoho facts", () => {
    renderEditor({ detail: { ...linked, zohoLink: null } });
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    const rail = screen.getByRole("complementary", { name: "Where it is" });
    expect(within(rail).queryByText("Zoho status")).toBeNull();
    expect(within(rail).queryByRole("link", { name: "From Zoho record" })).toBeNull();
  });
});

describe("an original on lax.art that is not linked to Zoho", () => {
  const original: AdminArtworkDetail = {
    ...detail,
    run: null,
    salesChannel: "art",
    printPricePence: null,
    editions: {
      size: 0,
      committed: 0,
      byStatus: { not_authorised: 0, authorised: 0, reserved: 0, held: 0, sold: 0, withdrawn: 0 },
      byAllocation: { original_buyer_entitlement: 0, artist: 0, lax: 0 },
    },
    zohoLink: null,
  };
  const viewOnly = {
    write: false,
    setPrice: false,
    correctFacts: false,
    approveHorsCommerce: false,
  };

  async function withAccess(
    capabilities: string[],
    props: Partial<React.ComponentProps<typeof ArtworkEditor>>,
  ) {
    const { StaffAccessProvider } = await import("@auction/staff-ui");
    const { laxStaffAccess } = await import("@/server/domain/lax-staff-access");
    return render(
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Catalogue editor")}>
        <ArtworkEditor detail={original} permissions={admin} currentYear={2026} {...props} />
      </StaffAccessProvider>,
    );
  }

  it("says it is not linked and offers Link to Zoho record to a catalogue editor", async () => {
    await withAccess(["catalogue.write", "artwork_register.review"], {});
    expect(screen.getByText("Not linked to Zoho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link to Zoho record…" }));
    expect(
      await screen.findByText("Harbour at Dusk · Ada Artist · Draft on lax.art"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search Zoho records")).toBeInTheDocument();
  });

  it("says what is wrong in one sentence, beside the way to fix it", async () => {
    await withAccess(["catalogue.write", "artwork_register.review"], {});
    expect(
      screen.getByText(
        "LAX can't stop this artwork being offered twice, and Zoho doesn't see where it is.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Stock code")).toBeInTheDocument();
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getByText(/Once linked, these fields come from Zoho/)).toBeInTheDocument();
  });

  it("shows the Where it is panel for a draft, saying the lock does not cover it", async () => {
    await withAccess(["catalogue.write", "artwork_register.review"], {});
    const panel = screen.getByRole("region", { name: "Where it is" });
    expect(within(panel).getByText("Draft on lax.art", { selector: "strong" })).toBeInTheDocument();
    expect(
      within(panel).getByText("Not linked to Zoho, so the one-place lock doesn't cover it."),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Link to Zoho record/ })).toBeNull();
  });

  it("shows a live original as On lax.art since it was published", async () => {
    const { StaffAccessProvider } = await import("@auction/staff-ui");
    const { laxStaffAccess } = await import("@/server/domain/lax-staff-access");
    render(
      <StaffAccessProvider access={laxStaffAccess(["catalogue.write"], "Catalogue editor")}>
        <ArtworkEditor
          detail={{ ...original, state: "live", publishedAt: "2026-10-09T10:00:00.000Z" }}
          permissions={admin}
          currentYear={2026}
        />
      </StaffAccessProvider>,
    );
    const panel = screen.getByRole("region", { name: "Where it is" });
    expect(within(panel).getByText("On lax.art")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Live on lax.art since");
  });

  it("says it too to someone who can only view, with no way to link", async () => {
    await withAccess(["catalogue.read", "artwork_register.read"], { permissions: viewOnly });
    expect(screen.getByText("Not linked to Zoho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link to Zoho record…" })).toBeNull();
  });

  it("offers no link without the permission to decide on the register", async () => {
    await withAccess(["catalogue.write"], {});
    expect(screen.getByText("Not linked to Zoho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link to Zoho record…" })).toBeNull();
  });

  it("says nothing of Zoho linking on a print edition", async () => {
    await withAccess(["catalogue.write", "artwork_register.review"], { detail });
    expect(screen.queryByText("Not linked to Zoho")).toBeNull();
  });
});

describe("New artwork > Original", () => {
  it("sends staff to From Zoho for an original, and not for prints", () => {
    renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
    expect(screen.queryByText("Originals come from Zoho")).toBeNull();
    fireEvent.click(document.getElementById("artwork-kind-original") as HTMLElement);
    expect(screen.getByText("Originals come from Zoho")).toBeInTheDocument();
    expect(
      screen.getByText("Find it in From Zoho and choose Offer on lax.art."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open From Zoho" })).toHaveAttribute(
      "href",
      "/from-zoho",
    );
    fireEvent.click(document.getElementById("artwork-kind-prints") as HTMLElement);
    expect(screen.queryByText("Originals come from Zoho")).toBeNull();
  });
});
