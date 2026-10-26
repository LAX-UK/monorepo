// @vitest-environment jsdom
import type { ExhibitionDetail } from "@/lib/editorial-entity-forms";
import type { LinksPayload } from "@/server/domain/editorial-links.vm";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveEditorialEntity = vi.fn();
const getEditorialEntityDetail = vi.fn();
const setEditorialPublication = vi.fn();
const issueEditorialPreviewToken = vi.fn();
const replaceEditorialLinkList = vi.fn();
const getEditorialLinks = vi.fn();
const searchEditorialLinkCandidates = vi.fn();
const resolveRailSlugs = vi.fn();

vi.mock("@/server/application/admin-editorial-actions.server", () => ({
  saveEditorialEntity,
  getEditorialEntityDetail,
  setEditorialPublication,
  issueEditorialPreviewToken,
}));
vi.mock("@/server/application/admin-editorial-links-actions.server", () => ({
  replaceEditorialLinkList,
  getEditorialLinks,
  searchEditorialLinkCandidates,
  resolveRailSlugs,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/editorial/exhibitions/e-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

// Radix dialogs, popovers and tooltips run positioning and focus loops jsdom cannot settle.
// These stand-ins keep their open and close contracts, so the editor's own behaviour is tested.
vi.mock("@auction/ui/components/dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui/components/dialog")>()),
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

window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { ExhibitionEditor } = await import("./editorial-editors.client");

const PARENT = "5b1c2d3e-0000-4000-8000-000000000001";
const ART_A = "5b1c2d3e-0000-4000-8000-0000000000a1";
const ART_B = "5b1c2d3e-0000-4000-8000-0000000000a2";
const ARTIST = "5b1c2d3e-0000-4000-8000-0000000000b1";
const OPENED = "2026-03-01T10:00:00.000Z";

const detail: ExhibitionDetail = {
  id: PARENT,
  slug: "summer-show",
  status: "draft",
  label: "Summer show",
  updatedAt: OPENED,
  kind: "exhibition",
  title: "Summer show",
  subtitle: null,
  summary: null,
  venueId: null,
  startsOn: null,
  endsOn: null,
  timesNote: null,
  coverMediaKey: null,
  featured: false,
  contactName: null,
  contactRole: null,
  contactEmail: null,
  contactPhone: null,
  contactAvatarMediaKey: null,
  body: [],
};

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

function renderEditor() {
  return render(
    <ExhibitionEditor detail={detail} venues={[]} links={links} artPublicUrl="https://lax.test" />,
  );
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
const section = (name: string) => within(screen.getByRole("region", { name }));
const removeTides = () => fireEvent.click(screen.getByRole("button", { name: "Remove Tides" }));

beforeEach(() => {
  for (const action of [
    saveEditorialEntity,
    getEditorialEntityDetail,
    replaceEditorialLinkList,
    getEditorialLinks,
    searchEditorialLinkCandidates,
    resolveRailSlugs,
  ]) {
    action.mockReset();
  }
  saveEditorialEntity.mockResolvedValue({
    ok: true,
    data: { id: PARENT, version: "2026-03-01T11:00:00.000Z" },
  });
  replaceEditorialLinkList.mockResolvedValue({ ok: true, data: { version: "v2" } });
  searchEditorialLinkCandidates.mockResolvedValue({
    ok: true,
    data: { items: [], nextCursor: null },
  });
});

describe("an exhibition's linked records", () => {
  it("shows the three lists with no Save button of their own", () => {
    renderEditor();
    expect(section("Artworks in this exhibition").getAllByRole("listitem")).toHaveLength(2);
    expect(section("Artists").getAllByRole("listitem")).toHaveLength(1);
    expect(section("Related stories").getByText("No stories linked yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Save/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Save artworks" })).not.toBeInTheDocument();
  });

  it("counts an edited list as an unsaved change and saves it with the one Save", async () => {
    renderEditor();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    removeTides();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    save();
    await waitFor(() => expect(replaceEditorialLinkList).toHaveBeenCalledTimes(1));
    expect(replaceEditorialLinkList).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: "exhibitions",
        id: PARENT,
        list: "artworks",
        ids: [ART_A],
        expectedVersion: "v1",
      }),
    );
    // The item's own fields did not change, so they are not sent again.
    expect(saveEditorialEntity).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
  });

  it("saves the fields first and the lists after them, in one go", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Summer show 2026" } });
    removeTides();

    save();

    await waitFor(() => expect(replaceEditorialLinkList).toHaveBeenCalledTimes(1));
    expect(saveEditorialEntity).toHaveBeenCalledTimes(1);
    expect(saveEditorialEntity.mock.invocationCallOrder[0]).toBeLessThan(
      replaceEditorialLinkList.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("sends each changed list against the version the previous one returned", async () => {
    replaceEditorialLinkList
      .mockResolvedValueOnce({ ok: true, data: { version: "v2" } })
      .mockResolvedValueOnce({ ok: true, data: { version: "v3" } });
    renderEditor();
    removeTides();
    fireEvent.click(screen.getByRole("button", { name: "Remove Ada Lee" }));

    save();

    await waitFor(() => expect(replaceEditorialLinkList).toHaveBeenCalledTimes(2));
    expect(replaceEditorialLinkList).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ list: "artworks", expectedVersion: "v1" }),
    );
    expect(replaceEditorialLinkList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ list: "artists", ids: [], expectedVersion: "v2" }),
    );
  });

  it("does not send the lists when the fields could not be saved", async () => {
    saveEditorialEntity.mockResolvedValue({ ok: false, kind: "failed", message: "" });
    renderEditor();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Summer show 2026" } });
    removeTides();

    save();

    await waitFor(() => expect(saveEditorialEntity).toHaveBeenCalledTimes(1));
    expect(replaceEditorialLinkList).not.toHaveBeenCalled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("says the fields were saved when only the lists fail", async () => {
    replaceEditorialLinkList.mockResolvedValue({ ok: false, kind: "failed", message: "" });
    renderEditor();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Summer show 2026" } });
    removeTides();

    save();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your changes to the exhibition were saved");
    expect(alert).toHaveTextContent("linked records were not");
  });

  it("offers to sign in again when the lists need a recent sign-in", async () => {
    replaceEditorialLinkList.mockResolvedValue({
      ok: false,
      kind: "step_up_required",
      message: "Recent authentication is required for this action",
    });
    renderEditor();
    removeTides();

    save();

    expect(await screen.findByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/api/auth/login?returnTo=%2Feditorial%2Fexhibitions%2Fe-1",
    );
  });

  it("names records that no longer exist instead of failing without a reason", async () => {
    replaceEditorialLinkList.mockResolvedValue({
      ok: false,
      kind: "unknown_ids",
      message: "Unknown ids",
      missingIds: [ART_A],
    });
    renderEditor();
    removeTides();

    save();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "“Paper Rooms” does not exist any more",
    );
  });

  it("explains a conflict and saves over the other version only when asked", async () => {
    replaceEditorialLinkList
      .mockResolvedValueOnce({
        ok: false,
        kind: "conflict",
        message: "stale",
        currentVersion: "v9",
      })
      .mockResolvedValueOnce({ ok: true, data: { version: "v10" } });
    renderEditor();
    removeTides();

    save();

    expect(
      await screen.findByText("Someone else changed the linked records of this exhibition"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save my version" }));

    await waitFor(() => expect(replaceEditorialLinkList).toHaveBeenCalledTimes(2));
    expect(replaceEditorialLinkList).toHaveBeenLastCalledWith(
      expect.objectContaining({ ids: [ART_A], expectedVersion: "v9" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("Someone else changed the linked records of this exhibition"),
      ).not.toBeInTheDocument(),
    );
  });

  it("reloads their version and drops your edits when asked", async () => {
    replaceEditorialLinkList.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "stale",
      currentVersion: "v9",
    });
    getEditorialLinks.mockResolvedValue({
      ok: true,
      data: { ...links, artworks: [linkItem(ART_B, "Tides")], version: "v9" },
    });
    renderEditor();
    removeTides();
    save();
    await screen.findByText("Someone else changed the linked records of this exhibition");

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard my changes and reload" }));

    await waitFor(() =>
      expect(section("Artworks in this exhibition").getAllByRole("listitem")).toHaveLength(1),
    );
    expect(screen.getByRole("button", { name: "Remove Tides" })).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });
});
