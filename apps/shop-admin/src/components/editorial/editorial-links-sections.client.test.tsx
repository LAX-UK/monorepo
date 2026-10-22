// @vitest-environment jsdom
import type { LinksPayload } from "@/server/domain/editorial-links.vm";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceEditorialLinkList = vi.fn();
const getEditorialLinks = vi.fn();
const searchEditorialLinkCandidates = vi.fn();

vi.mock("@/server/application/admin-editorial-links-actions.server", () => ({
  replaceEditorialLinkList,
  getEditorialLinks,
  searchEditorialLinkCandidates,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/editorial/exhibitions/e-1",
}));
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  toast: { success: vi.fn() },
}));

// The search list measures itself, which jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const { EditorialLinksSections } = await import("./editorial-links-sections.client");

const PARENT = "5b1c2d3e-0000-4000-8000-000000000001";
const ART_A = "5b1c2d3e-0000-4000-8000-0000000000a1";
const ART_B = "5b1c2d3e-0000-4000-8000-0000000000a2";
const ARTIST = "5b1c2d3e-0000-4000-8000-0000000000b1";

const linkItem = (id: string, title: string) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  thumbnailUrl: null,
  published: true,
});

const links: LinksPayload = {
  artworks: [linkItem(ART_A, "Paper Rooms"), linkItem(ART_B, "Tides")],
  artists: [linkItem(ARTIST, "Ada Lee")],
  stories: [],
  version: "v1",
};

const onDirtyChange = vi.fn();

function renderSections() {
  return render(
    <EditorialLinksSections
      parent="exhibitions"
      id={PARENT}
      links={links}
      onDirtyChange={onDirtyChange}
    />,
  );
}

const section = (name: string) => within(screen.getByRole("region", { name }));

function moveTidesUp() {
  fireEvent.click(screen.getByRole("button", { name: "Move Tides up" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  searchEditorialLinkCandidates.mockResolvedValue({
    ok: true,
    data: { items: [], nextCursor: null },
  });
});

describe("EditorialLinksSections", () => {
  it("shows the three exhibition sections with their saved lists", () => {
    renderSections();
    expect(section("Artworks in this exhibition").getAllByRole("listitem")).toHaveLength(2);
    expect(section("Artists").getAllByRole("listitem")).toHaveLength(1);
    expect(section("Related stories").getByText("No stories linked yet.")).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("only offers Save once a list has changed, and reports the unsaved edit", () => {
    renderSections();
    const save = screen.getByRole("button", { name: "Save artworks" });
    expect(save).toBeDisabled();

    moveTidesUp();

    expect(save).toBeEnabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Save artists" })).toBeDisabled();
  });

  it("saves one list in order against the current version and then goes clean", async () => {
    replaceEditorialLinkList.mockResolvedValue({ ok: true, data: { version: "v2" } });
    renderSections();
    moveTidesUp();

    fireEvent.click(screen.getByRole("button", { name: "Save artworks" }));

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(replaceEditorialLinkList).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: "exhibitions",
        id: PARENT,
        list: "artworks",
        ids: [ART_B, ART_A],
        expectedVersion: "v1",
      }),
    );
  });

  it("sends the version returned by the previous save with the next one", async () => {
    replaceEditorialLinkList.mockResolvedValue({ ok: true, data: { version: "v2" } });
    renderSections();
    moveTidesUp();
    fireEvent.click(screen.getByRole("button", { name: "Save artworks" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save artworks" })).toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Ada Lee" }));
    fireEvent.click(screen.getByRole("button", { name: "Save artists" }));

    await waitFor(() => expect(replaceEditorialLinkList).toHaveBeenCalledTimes(2));
    expect(replaceEditorialLinkList).toHaveBeenLastCalledWith(
      expect.objectContaining({ list: "artists", ids: [], expectedVersion: "v2" }),
    );
  });

  describe("when someone else changed the links (409)", () => {
    beforeEach(() => {
      replaceEditorialLinkList.mockResolvedValueOnce({
        ok: false,
        kind: "conflict",
        message: "Links changed",
        currentVersion: "v7",
      });
    });

    it("shows the conflict banner and keeps the edit", async () => {
      renderSections();
      moveTidesUp();
      fireEvent.click(screen.getByRole("button", { name: "Save artworks" }));

      expect(await screen.findByText("Someone else changed this list of artworks")).toBeVisible();
      expect(screen.getByRole("button", { name: "Save artworks" })).toBeEnabled();
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });

    it("reloads the stored list after confirming that the edits are discarded", async () => {
      getEditorialLinks.mockResolvedValue({
        ok: true,
        data: { ...links, artworks: [linkItem(ART_B, "Tides")], version: "v7" },
      });
      renderSections();
      moveTidesUp();
      fireEvent.click(screen.getByRole("button", { name: "Save artworks" }));
      fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
      fireEvent.click(screen.getByRole("button", { name: "Discard my changes and reload" }));

      await waitFor(() =>
        expect(section("Artworks in this exhibition").getAllByRole("listitem")).toHaveLength(1),
      );
      expect(getEditorialLinks).toHaveBeenCalledWith("exhibitions", PARENT);
      expect(screen.queryByText(/Someone else changed/)).not.toBeInTheDocument();
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it("keeps my version and resends it with the version that won", async () => {
      replaceEditorialLinkList.mockResolvedValueOnce({ ok: true, data: { version: "v8" } });
      renderSections();
      moveTidesUp();
      fireEvent.click(screen.getByRole("button", { name: "Save artworks" }));
      fireEvent.click(await screen.findByRole("button", { name: "Keep my changes" }));
      fireEvent.click(screen.getByRole("button", { name: "Save my version" }));

      await waitFor(() => expect(replaceEditorialLinkList).toHaveBeenCalledTimes(2));
      expect(replaceEditorialLinkList).toHaveBeenLastCalledWith(
        expect.objectContaining({ ids: [ART_B, ART_A], expectedVersion: "v7" }),
      );
      await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    });
  });

  it("names the records that no longer exist (422) and keeps the list", async () => {
    replaceEditorialLinkList.mockResolvedValue({
      ok: false,
      kind: "unknown_ids",
      message: "Unknown ids",
      missingIds: [ART_A],
    });
    renderSections();
    moveTidesUp();
    fireEvent.click(screen.getByRole("button", { name: "Save artworks" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save artworks: “Paper Rooms” does not exist any more. Remove it from the list and save again.",
    );
    expect(section("Artworks in this exhibition").getAllByRole("listitem")).toHaveLength(2);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("warns when a list is longer than the public rail", () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      linkItem(`5b1c2d3e-0000-4000-8000-${String(index).padStart(12, "0")}`, `Work ${index}`),
    );
    render(
      <EditorialLinksSections
        parent="exhibitions"
        id={PARENT}
        links={{ ...links, artworks: many }}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(screen.getByText("Only the first 24 appear on lax.art.")).toBeInTheDocument();
  });

  it("does not submit an enclosing form when Enter is pressed in a search box", () => {
    const submit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <EditorialLinksSections
          parent="exhibitions"
          id={PARENT}
          links={links}
          onDirtyChange={onDirtyChange}
        />
      </form>,
    );
    const input = screen.getAllByRole("combobox", { name: /Search to add/ })[0];
    if (!input) throw new Error("no search box");
    const notCancelled = fireEvent.keyDown(input, { key: "Enter" });
    expect(notCancelled).toBe(false);
  });
});

describe("unordered sections", () => {
  it("offers no reordering for related stories", () => {
    render(
      <EditorialLinksSections
        parent="exhibitions"
        id={PARENT}
        links={{ ...links, stories: [linkItem("s1", "Studio visit"), linkItem("s2", "Open call")] }}
        onDirtyChange={onDirtyChange}
      />,
    );
    const stories = section("Related stories");
    expect(stories.queryByRole("button", { name: /Move/ })).not.toBeInTheDocument();
    expect(stories.getByRole("button", { name: "Remove Studio visit" })).toBeInTheDocument();
  });
});
