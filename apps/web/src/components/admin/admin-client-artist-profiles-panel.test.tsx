import { StaffTooltipProvider } from "@auction/staff-ui";
import type { ArtistProfile } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminClientArtistProfilesPanel } from "./admin-client-artist-profiles-panel";

const push = vi.fn();
const refresh = vi.fn();
const createArtist = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminCreateArtistResultAction: (...args: unknown[]) => createArtist(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));

const artist = {
  id: "artist_1",
  displayName: "Ada Lovelace Studio",
  slug: "ada-lovelace-studio",
  kind: "studio",
  status: "pending",
  archived: false,
} as unknown as ArtistProfile;

function panel(props: { canCreate?: boolean; linkedArtists?: ArtistProfile[] } = {}) {
  render(
    <StaffTooltipProvider>
      <AdminClientArtistProfilesPanel
        userId="user_1"
        userName="Ada Lovelace"
        linkedArtists={props.linkedArtists ?? []}
        {...(props.canCreate !== undefined ? { canCreate: props.canCreate } : {})}
      />
    </StaffTooltipProvider>,
  );
}

const openDialog = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create artist profile" }));

describe("AdminClientArtistProfilesPanel", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    createArtist.mockReset();
    notifySuccess.mockReset();
  });

  it("lists linked profiles with their type and status in words", () => {
    panel({ linkedArtists: [artist] });

    const table = screen.getByRole("table", { name: "Linked artist profiles" });
    expect(within(table).getByRole("link", { name: "Ada Lovelace Studio" })).toHaveAttribute(
      "href",
      "/admin/artists/artist_1/edit",
    );
    expect(within(table).getByText("Pending review")).toBeInTheDocument();
    expect(within(table).queryByText(/pending$/)).toBeNull();
  });

  it("says what will appear when no profile is linked", () => {
    panel();
    expect(screen.getByText("No linked artist profiles")).toBeInTheDocument();
  });

  it("is a secondary sentence-case button, and left out for roles that cannot create", () => {
    panel();
    const button = screen.getByRole("button", { name: "Create artist profile" });
    expect(button.className).not.toMatch(/uppercase|bg-lax-ink /);
    expect(button.className).toMatch(/border-lax-line-strong/);
  });

  it("offers no create button to a role that cannot create artist profiles", () => {
    panel({ canCreate: false });
    expect(screen.queryByRole("button", { name: /create artist profile/i })).toBeNull();
  });

  it("opens a dialog that names the person and puts Cancel first", async () => {
    panel();
    openDialog();

    expect(
      await screen.findByText("Create an artist profile for Ada Lovelace"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  });

  it("creates the profile linked to this account, then opens it", async () => {
    createArtist.mockResolvedValue({ ok: true, data: { id: "artist_9" } });
    panel();
    openDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Create profile" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/artists/artist_9/edit"));
    expect(createArtist).toHaveBeenCalledWith({
      displayName: "Ada Lovelace",
      kind: "artist",
      ownerUserId: "user_1",
    });
    expect(notifySuccess).toHaveBeenCalledWith("Artist profile created for Ada Lovelace");
  });

  it("keeps a failure in the dialog, with what was typed", async () => {
    createArtist.mockResolvedValue({ ok: false, error: "That name is already taken." });
    panel();
    openDialog();
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Ada L." } });
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That name is already taken.");
    expect(screen.getByLabelText("Name")).toHaveValue("Ada L.");
    expect(push).not.toHaveBeenCalled();
  });

  it("asks for a name before sending anything", async () => {
    panel();
    openDialog();
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));

    expect(await screen.findByText("Enter the profile's name.")).toBeInTheDocument();
    expect(createArtist).not.toHaveBeenCalled();
  });
});
