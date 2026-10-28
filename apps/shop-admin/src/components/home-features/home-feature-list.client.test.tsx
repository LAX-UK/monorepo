// @vitest-environment jsdom
import type {
  AdminHomeFeatureArtist,
  AdminHomeFeaturePrint,
  AdminHomeFeatures,
} from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

(await import("@/test/radix-stubs")).installLayoutStubs();
const { HomeFeatureList } = await import("./home-feature-list.client");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const print = (n: number, over: Partial<AdminHomeFeaturePrint> = {}): AdminHomeFeaturePrint => ({
  id: id(n),
  title: `Print ${n}`,
  artistName: "Flora Powers",
  thumbnailUrl: "https://example.test/print.jpg",
  live: true,
  soldOut: false,
  hasImage: true,
  ...over,
});

const artist = (n: number, over: Partial<AdminHomeFeatureArtist> = {}): AdminHomeFeatureArtist => ({
  id: id(100 + n),
  name: `Artist ${n}`,
  discipline: "Painter",
  portraitUrl: null,
  onArt: true,
  hasEditionsOnSale: true,
  ...over,
});

const EMPTY: AdminHomeFeatures = {
  featured_prints: [],
  featured_artists: [],
  featured_categories: [],
};

function rowTexts(name: string) {
  return within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span.truncate")?.textContent);
}

function statusOf(name: string, title: string) {
  const row = within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(title));
  if (!row) throw new Error(`No row ${title}`);
  return row;
}

beforeEach(() => {
  toastSuccess.mockReset();
});

describe("HomeFeatureList", () => {
  it("says what the home does when a list is empty", () => {
    render(<HomeFeatureList slot="featured_prints" saved={[]} />);
    expect(
      screen.getByText("No prints chosen. The Shop home leads with its newest edition on sale."),
    ).toBeInTheDocument();
  });

  it("marks the print the Shop home leads with, and why the ones above it are skipped", () => {
    render(
      <HomeFeatureList
        slot="featured_prints"
        saved={[
          print(1, { soldOut: true }),
          print(2, { hasImage: false, thumbnailUrl: null }),
          print(3),
          print(4),
        ]}
      />,
    );
    const list = "Featured prints";
    expect(within(statusOf(list, "Print 1")).getByText("Skipped: sold out")).toBeInTheDocument();
    expect(within(statusOf(list, "Print 2")).getByText("Skipped: no image")).toBeInTheDocument();
    expect(
      within(statusOf(list, "Print 3")).getByText("Used as the Shop home release"),
    ).toBeInTheDocument();
    expect(within(statusOf(list, "Print 4")).getByText("Next in line")).toBeInTheDocument();
  });

  it("says where each artist appears", () => {
    render(
      <HomeFeatureList
        slot="featured_artists"
        saved={[artist(1), artist(2, { hasEditionsOnSale: false })]}
      />,
    );
    const list = "Featured artists";
    const first = within(statusOf(list, "Artist 1"));
    expect(first.getByText("On lax.art")).toBeInTheDocument();
    expect(first.getByText("On LAX Shop")).toBeInTheDocument();
    expect(
      within(statusOf(list, "Artist 2")).getByText("Not on Shop: no editions on sale"),
    ).toBeInTheDocument();
  });

  it("reorders, recomputes the release, and saves the new order with a toast", async () => {
    const save = vi.fn(async () => ({
      ok: true as const,
      data: { ...EMPTY, featured_prints: [print(2), print(1, { soldOut: true })] },
    }));
    const onSaved = vi.fn();
    render(
      <HomeFeatureList
        slot="featured_prints"
        saved={[print(1, { soldOut: true }), print(2)]}
        actions={{ search: async () => [], save }}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByRole("button", { name: "Save prints" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Move Print 2" }), { key: "ArrowUp" });
    expect(rowTexts("Featured prints")).toEqual(["Print 2", "Print 1"]);
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(
      within(statusOf("Featured prints", "Print 2")).getByText("Used as the Shop home release"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save prints" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Featured prints saved"));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ slot: "featured_prints", ids: [id(2), id(1)] }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("adds from the search, shows what is already in the list, and removes", async () => {
    const search = vi.fn(async () => [artist(1), artist(2, { hasEditionsOnSale: false })]);
    render(
      <HomeFeatureList
        slot="featured_artists"
        saved={[artist(1)]}
        actions={{ search, save: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Add an artist" }));
    const added = await screen.findByRole("option", { name: /Artist 1/ });
    expect(added).toHaveTextContent("Added");
    const next = await screen.findByRole("option", { name: /Artist 2/ });
    expect(next).toHaveTextContent("No editions on sale");
    fireEvent.click(next);
    await waitFor(() => expect(rowTexts("Featured artists")).toEqual(["Artist 1", "Artist 2"]));

    fireEvent.click(screen.getByRole("button", { name: "Remove Artist 1" }));
    expect(rowTexts("Featured artists")).toEqual(["Artist 2"]);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(rowTexts("Featured artists")).toEqual(["Artist 1"]);
  });

  it("stops adding at 8 artists and says why", () => {
    render(
      <HomeFeatureList
        slot="featured_artists"
        saved={Array.from({ length: 8 }, (_, n) => artist(n))}
        actions={{ search: async () => [], save: vi.fn() }}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Add an artist" })).toBeDisabled();
    expect(
      screen.getByText("The list is full at 8 artists. Remove one to add another."),
    ).toBeInTheDocument();
  });

  it("marks the rows a refused save names, and keeps the edits", async () => {
    const save = vi.fn(async () => ({
      ok: false as const,
      kind: "validation" as const,
      message: "Row 2 no longer exists. Nothing was saved.",
      issues: [{ index: 1, targetId: id(102), reason: "unknown" }],
    }));
    render(
      <HomeFeatureList
        slot="featured_artists"
        saved={[artist(2), artist(1)]}
        actions={{ search: async () => [], save }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move Artist 1 up" }));
    fireEvent.click(screen.getByRole("button", { name: "Save artists" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Row 2 no longer exists. Nothing was saved.",
    );
    const row = statusOf("Featured artists", "Artist 2");
    expect(row).toHaveAttribute("data-invalid", "true");
    expect(
      within(row).getByText("This artist no longer exists. Remove it to save."),
    ).toBeInTheDocument();
    expect(rowTexts("Featured artists")).toEqual(["Artist 1", "Artist 2"]);
  });

  it("is read-only without actions: no handles, no search, no save", () => {
    render(<HomeFeatureList slot="featured_artists" saved={[artist(1), artist(2)]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(rowTexts("Featured artists")).toEqual(["Artist 1", "Artist 2"]);
  });
});
