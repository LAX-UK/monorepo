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
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  createArtwork,
  saveArtwork,
  saveArtworkPrice,
  setArtworkVisibility,
  getArtworkDetail,
  searchArtistOptions: vi.fn(async () => []),
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
vi.mock("@auction/ui/components/radio-group", () => ({
  RadioGroup: ({ children }: { children: React.ReactNode }) => (
    <div role="radiogroup">{children}</div>
  ),
  RadioGroupItem: ({ id, value }: { id?: string; value: string }) => (
    <span role="radio" tabIndex={-1} aria-checked={false} id={id} data-value={value} />
  ),
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
  eligibleForEditionAllocation: true,
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

const admin = { write: true, setPrice: true };

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
      toastSuccess,
      toastError,
    ]) {
      mock.mockReset();
    }
    window.history.replaceState(null, "", "/artworks/a-1");
  });

  describe("validation", () => {
    it("shows each problem beside its field and in a linked summary", () => {
      renderEditor({ detail: null });
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
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);
      expect(screen.getAllByText("Enter the artwork's title.").length).toBe(2);
      typeInto("Title", "Harbour at Dusk");
      expect(screen.queryByText("Enter the artwork's title.")).toBeNull();
    });
  });

  describe("creating", () => {
    it("creates a draft in pence with the slug from the title, then opens it", async () => {
      createArtwork.mockResolvedValue({
        ok: true,
        data: { artworkId: detail.artworkId, slug: "harbour-at-dusk", version: OPENED },
      });
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      typeInto("Title", "Harbour at Dusk");
      typeInto(/Price per edition/, "1,250.50");
      expect(screen.getByLabelText(/Web address/)).toHaveValue("harbour-at-dusk");
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);

      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/artworks/${detail.artworkId}`));
      expect(createArtwork.mock.calls[0]?.[0].body).toMatchObject({
        title: "Harbour at Dusk",
        slug: "harbour-at-dusk",
        artistId: ARTIST,
        eligibleForEditionAllocation: true,
        printPricePence: 125_050,
      });
      expect(toastSuccess).toHaveBeenCalledWith("Created “Harbour at Dusk” as a draft");
    });

    it("shows a taken slug on the slug field", async () => {
      createArtwork.mockResolvedValue({
        ok: false,
        kind: "conflict",
        message: "That slug is already used by another artwork.",
      });
      renderEditor({ detail: null, initialArtist: { id: ARTIST, name: "Ada Artist" } });
      typeInto("Title", "Harbour at Dusk");
      fireEvent.click(screen.getAllByRole("button", { name: "Create draft" })[0] as HTMLElement);
      await waitFor(() =>
        expect(screen.getByLabelText(/Web address/)).toHaveAttribute("aria-invalid", "true"),
      );
      expect(replace).not.toHaveBeenCalled();
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
      renderEditor({ permissions: { write: true, setPrice: false } });
      const price = screen.getByLabelText(/Price per edition/);
      expect(price).toBeDisabled();
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
      expect(within(dialog).getByText("Leave without saving?")).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Leave without saving" }));
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
    renderEditor({ permissions: { write: false, setPrice: false } });
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("lets finance change only the price, through the price endpoint", async () => {
    saveArtworkPrice.mockResolvedValue({ ok: true, data: { version: THEIRS } });
    renderEditor({ permissions: { write: false, setPrice: true } });
    expect(screen.getByLabelText("Title")).toBeDisabled();
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
