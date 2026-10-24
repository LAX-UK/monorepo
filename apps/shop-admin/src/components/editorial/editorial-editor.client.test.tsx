// @vitest-environment jsdom
import type { ExhibitionDetail } from "@/lib/editorial-entity-forms";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveEditorialEntity = vi.fn();
const getEditorialEntityDetail = vi.fn();
const setEditorialPublication = vi.fn();
const issueEditorialPreviewToken = vi.fn();
const push = vi.fn();
const replace = vi.fn();

vi.mock("@/server/application/admin-editorial-actions.server", () => ({
  saveEditorialEntity,
  getEditorialEntityDetail,
  setEditorialPublication,
  issueEditorialPreviewToken,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/editorial/exhibitions/e-1",
}));
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  toast: { success: vi.fn() },
}));

// The date pickers measure and match the viewport, which jsdom does not implement.
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

const OPENED = "2026-03-01T10:00:00.000Z";
const THEIRS = "2026-03-01T11:30:00.000Z";
const MINE = "2026-03-01T11:45:00.000Z";

const detail: ExhibitionDetail = {
  id: "5b1c2d3e-0000-4000-8000-000000000001",
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

function renderEditor(saved: ExhibitionDetail | null = detail) {
  return render(<ExhibitionEditor detail={saved} venues={[]} artPublicUrl="https://lax.test" />);
}

function editTitle(value: string) {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value } });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("exhibition editor saving", () => {
  beforeEach(() => {
    for (const action of [
      saveEditorialEntity,
      getEditorialEntityDetail,
      setEditorialPublication,
      issueEditorialPreviewToken,
      push,
      replace,
    ]) {
      action.mockReset();
    }
    saveEditorialEntity.mockResolvedValue({ ok: true, data: { id: detail.id, version: MINE } });
  });

  it("saves only when asked and sends the version it opened", async () => {
    renderEditor();
    editTitle("Summer show 2026");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(saveEditorialEntity).not.toHaveBeenCalled();

    save();
    await waitFor(() => expect(saveEditorialEntity).toHaveBeenCalledTimes(1));
    expect(saveEditorialEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "exhibitions",
        id: detail.id,
        expectedVersion: OPENED,
        payload: expect.objectContaining({ title: "Summer show 2026", subtitle: null }),
      }),
    );
    expect(await screen.findByText("Saved 11:45")).toBeInTheDocument();
  });

  it("sends the new version on the next save", async () => {
    renderEditor();
    editTitle("One");
    save();
    await screen.findByText("Saved 11:45");
    editTitle("Two");
    save();
    await waitFor(() => expect(saveEditorialEntity).toHaveBeenCalledTimes(2));
    expect(saveEditorialEntity).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedVersion: MINE }),
    );
  });

  it("lists field problems and does not send anything", async () => {
    renderEditor();
    editTitle("");
    save();
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a title.");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(saveEditorialEntity).not.toHaveBeenCalled();
  });

  it("creates a draft and moves to its editor", async () => {
    saveEditorialEntity.mockResolvedValue({ ok: true, data: { id: "new-id", version: null } });
    renderEditor(null);
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "autumn-show" } });
    editTitle("Autumn show");
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/editorial/exhibitions/new-id"));
    expect(saveEditorialEntity).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, expectedVersion: null }),
    );
  });

  it("points a slug clash at the slug field", async () => {
    saveEditorialEntity.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "Slug is already in use",
    });
    renderEditor();
    editTitle("Summer show 2026");
    save();
    expect(await screen.findByRole("alert")).toHaveTextContent("That slug is already in use");
    expect(screen.getByLabelText("Slug")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Someone else saved/)).not.toBeInTheDocument();
  });
});

describe("exhibition editor when someone else saved first", () => {
  beforeEach(() => {
    for (const action of [saveEditorialEntity, getEditorialEntityDetail]) action.mockReset();
    saveEditorialEntity.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "changed",
      currentVersion: THEIRS,
    });
  });

  async function conflictOn() {
    renderEditor();
    editTitle("My title");
    save();
    return screen.findByText("Someone else saved this exhibition at 11:30");
  }

  it("says who got there first and offers both ways out", async () => {
    await conflictOn();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep my changes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("My title");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("reloads their version only after the editor confirms losing their own", async () => {
    getEditorialEntityDetail.mockResolvedValue({
      ok: true,
      data: { ...detail, title: "Their title", updatedAt: THEIRS },
    });
    await conflictOn();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(getEditorialEntityDetail).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Your unsaved changes");

    fireEvent.click(screen.getByRole("button", { name: "Discard my changes and reload" }));
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Their title"));
    expect(screen.queryByText(/Someone else saved/)).not.toBeInTheDocument();
    expect(screen.getByText("Saved 11:30")).toBeInTheDocument();
  });

  it("keeps the editor's changes by saving again on top of the new version, after a confirm", async () => {
    await conflictOn();
    saveEditorialEntity.mockResolvedValueOnce({ ok: true, data: { id: detail.id, version: MINE } });
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    expect(saveEditorialEntity).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("dialog")).toHaveTextContent("cannot be recovered");

    fireEvent.click(screen.getByRole("button", { name: "Save my version" }));
    await waitFor(() => expect(saveEditorialEntity).toHaveBeenCalledTimes(2));
    expect(saveEditorialEntity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedVersion: THEIRS,
        payload: expect.objectContaining({ title: "My title" }),
      }),
    );
    await waitFor(() => expect(screen.queryByText(/Someone else saved/)).not.toBeInTheDocument());
  });
});

describe("exhibition editor publishing and leaving", () => {
  beforeEach(() => {
    for (const action of [saveEditorialEntity, setEditorialPublication, push]) action.mockReset();
  });

  it("asks before publishing and takes on the new version", async () => {
    setEditorialPublication.mockResolvedValue({ ok: true, data: { version: THEIRS } });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog", { name: "Publish “Summer show”" });
    expect(dialog).toHaveTextContent("goes live on lax.art");
    expect(setEditorialPublication).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(setEditorialPublication).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("will not publish or preview with unsaved changes", () => {
    renderEditor();
    editTitle("Changed");
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create preview link" })).toBeDisabled();
  });

  it("holds a click on a link while there are unsaved changes, until the editor agrees", async () => {
    render(
      <>
        <a href="/editorial/exhibitions">Exhibitions</a>
        <ExhibitionEditor detail={detail} venues={[]} artPublicUrl={null} />
      </>,
    );
    editTitle("Changed");
    fireEvent.click(screen.getByRole("link", { name: "Exhibitions" }));
    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/editorial/exhibitions"));
  });

  describe("browser Back", () => {
    const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

    async function pressBack() {
      await act(async () => {
        window.history.back();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }

    beforeEach(async () => {
      saveEditorialEntity.mockResolvedValue({ ok: true, data: { id: detail.id, version: MINE } });
      // Entries left by earlier tests' unsaved editors would swallow this test's Back.
      cleanup();
      while ("__unsavedChangesGuard" in ((window.history.state as object | null) ?? {})) {
        await pressBack();
      }
    });

    it("asks before leaving with unsaved changes, and stays when told to", async () => {
      renderEditor();
      editTitle("Changed");
      await pressBack();
      expect(
        await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
      expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
      expect(screen.getByLabelText("Title")).toHaveValue("Changed");

      // The guard re-armed, so a second Back asks again.
      await pressBack();
      expect(
        await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
      ).toBeInTheDocument();
    });

    it("goes back once the editor has been saved, without asking", async () => {
      renderEditor();
      editTitle("Changed");
      save();
      await screen.findByText("Saved 11:45");
      await settle();

      await pressBack();
      expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
    });
  });
});
