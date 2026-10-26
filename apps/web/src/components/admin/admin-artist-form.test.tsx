import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import type { ArtistFormValues } from "@/components/admin/artist-form/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, createMock, updateMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/admin/artists/new",
}));
vi.mock("@/lib/actions/admin", () => ({
  adminCreateArtistResultAction: (...args: unknown[]) => createMock(...args),
  adminUpdateArtistResultAction: (...args: unknown[]) => updateMock(...args),
}));
vi.mock("@/lib/actions/admin-users-browse", () => ({
  searchAdminUsersBrowseAction: vi.fn(),
  resolveAdminUserForPickerAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const blank: ArtistFormValues = {
  displayName: "",
  kind: "artist",
  status: "approved",
  portraitUrl: "",
  heroImageUrl: "",
  shortBio: "",
  longBio: "",
  statement: "",
  nationality: "",
  location: "",
  countryCode: "",
  birthYear: "",
  deathYear: "",
  foundedYear: "",
  dissolvedYear: "",
  websiteUrl: "",
  ownerUserId: null,
  featured: false,
  verified: false,
  archived: false,
  categoryIds: [],
  attributes: {},
};

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, value),
  } as Storage;
}

describe("AdminArtistForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("keeps Create artist enabled and lists what is missing when submitted empty", async () => {
    render(<AdminArtistForm mode="create" defaultValues={blank} />);
    const submit = screen.getByRole("button", { name: "Create artist" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(screen.getByRole("alert", { name: "There is a problem" })).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Display name is required")).toHaveLength(2);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("clears the error as soon as the name is typed", async () => {
    render(<AdminArtistForm mode="create" defaultValues={blank} />);
    fireEvent.click(screen.getByRole("button", { name: "Create artist" }));
    await screen.findByRole("alert", { name: "There is a problem" });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Ada Marsh" } });
    await waitFor(() => expect(screen.queryByText("Display name is required")).toBeNull());
  });

  it("creates the artist and opens its page", async () => {
    createMock.mockResolvedValue({ ok: true, data: { id: "artist-9" } });
    render(<AdminArtistForm mode="create" defaultValues={blank} />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Ada Marsh" } });
    fireEvent.click(screen.getByRole("button", { name: "Create artist" }));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/artists/artist-9"));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Ada Marsh" }));
  });

  it("asks for a linked account when the profile is a maker", async () => {
    render(
      <AdminArtistForm
        mode="create"
        defaultValues={{ ...blank, displayName: "Ada", kind: "maker" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Create artist" }));
    await waitFor(() =>
      expect(
        screen.getAllByText("Link the platform account of the seller who makes this work."),
      ).toHaveLength(2),
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("keeps the form and says why when the save is refused", async () => {
    updateMock.mockResolvedValue({ ok: false, error: "The artist changed elsewhere." });
    render(
      <AdminArtistForm
        mode="edit"
        artistId="artist-1"
        displayName="Ada Marsh"
        slug="ada-marsh"
        defaultValues={{ ...blank, displayName: "Ada Marsh" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The artist changed elsewhere.")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Ada Marsh");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("offers a saved draft of a new profile and fills the form from it", async () => {
    window.localStorage.setItem(
      "lax_admin_wizard_draft:admin_artist_new:new",
      JSON.stringify({
        stepIndex: 0,
        values: { displayName: "Half typed" },
        savedAt: new Date().toISOString(),
      }),
    );
    render(<AdminArtistForm mode="create" defaultValues={blank} />);
    fireEvent.click(await screen.findByRole("button", { name: "Resume draft" }));
    expect(screen.getByLabelText("Display name")).toHaveValue("Half typed");
  });

  it("is read-only for a merged profile", () => {
    render(
      <AdminArtistForm
        mode="edit"
        artistId="artist-1"
        displayName="Ada Marsh"
        defaultValues={{ ...blank, displayName: "Ada Marsh" }}
        readOnly
      />,
    );
    expect(screen.getByLabelText("Display name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
