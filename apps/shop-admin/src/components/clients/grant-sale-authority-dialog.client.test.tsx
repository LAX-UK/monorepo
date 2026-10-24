// @vitest-environment jsdom
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const grantArtworkSaleAuthority = vi.fn();
const searchPartyOptions = vi.fn();
const searchArtworkOptions = vi.fn();

vi.mock("@/server/application/admin-people-actions.server", () => ({ grantArtworkSaleAuthority }));
vi.mock("@/server/application/admin-lookup-actions.server", () => ({
  searchPartyOptions,
  searchArtworkOptions,
  searchEditionOptions: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/clients/p-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { GrantSaleAuthorityDialog } = await import("./grant-sale-authority-dialog.client");

const CLIENT: LookupOption = { id: "p-1", label: "Ada Lovelace", description: "Person" };
const OWNED: LookupOption[] = [
  { id: "a-1", label: "Vessel Study", description: "Holds editions 1, 2" },
];

function renderDialog() {
  return render(
    <GrantSaleAuthorityDialog open onOpenChange={vi.fn()} client={CLIENT} ownedArtworks={OWNED} />,
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Grant sale authority" });

function pickArtwork(name: RegExp) {
  fireEvent.click(within(dialog()).getByRole("combobox", { name: "Artwork" }));
  return screen.findByRole("option", { name });
}

beforeEach(() => {
  grantArtworkSaleAuthority.mockReset();
  searchPartyOptions.mockReset();
  searchArtworkOptions.mockReset();
  grantArtworkSaleAuthority.mockResolvedValue({ ok: true, data: {} });
  searchPartyOptions.mockResolvedValue([
    { id: "p-2", label: "Ada Byron", description: "ada.byron@example.com", meta: "Person" },
  ]);
  searchArtworkOptions.mockResolvedValue([
    { id: "a-9", label: "Night Garden", description: "Theo Marsh" },
  ]);
});

describe("granting sale authority", () => {
  it("asks for an owner, an artwork and a count by name, never by id", () => {
    renderDialog();
    const form = dialog();
    expect(within(form).queryByLabelText(/party id/i)).not.toBeInTheDocument();
    expect(within(form).queryByLabelText(/artwork id/i)).not.toBeInTheDocument();
    expect(within(form).getByRole("combobox", { name: "Owner" })).toHaveTextContent("Ada Lovelace");
    expect(within(form).getByRole("combobox", { name: "Artwork" })).toBeInTheDocument();
  });

  it("offers the artworks the client already holds first, each once, before anything is typed", async () => {
    renderDialog();
    const option = await pickArtwork(/Vessel Study/);
    expect(option).toHaveTextContent("Holds editions 1, 2");
    expect(searchArtworkOptions).not.toHaveBeenCalled();
  });

  it("searches every artwork by title or artist once something is typed", async () => {
    renderDialog();
    fireEvent.click(within(dialog()).getByRole("combobox", { name: "Artwork" }));
    fireEvent.change(await screen.findByPlaceholderText("Search by title or artist"), {
      target: { value: "night" },
    });

    expect(await screen.findByRole("option", { name: /Night Garden/ })).toHaveTextContent(
      "Theo Marsh",
    );
    expect(searchArtworkOptions).toHaveBeenCalledWith("night");
  });

  it("finds another owner by email and tells people of the same name apart", async () => {
    renderDialog();
    fireEvent.click(within(dialog()).getByRole("combobox", { name: "Owner" }));
    fireEvent.change(await screen.findByPlaceholderText("Search by name or email"), {
      target: { value: "byron" },
    });

    const option = await screen.findByRole("option", { name: /Ada Byron/ });
    expect(option).toHaveTextContent("ada.byron@example.com");
    expect(searchPartyOptions).toHaveBeenCalledWith("byron");
  });

  it("names everything that is missing and sends nothing", () => {
    renderDialog();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Grant authority" }));

    const form = dialog();
    expect(within(form).getByText("Choose the artwork they may sell.")).toBeInTheDocument();
    expect(within(form).getByText("Choose how many editions they may sell.")).toBeInTheDocument();
    expect(
      within(form).getByText("Say what the authority is based on, such as a signed agreement."),
    ).toBeInTheDocument();
    expect(grantArtworkSaleAuthority).not.toHaveBeenCalled();
  });

  it("offers a closed list of counts, so a number cannot be mistyped", () => {
    renderDialog();
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(11);
    expect(options[1]).toHaveTextContent("1 edition");
    expect(options[10]).toHaveTextContent("10 editions");
  });

  it("repeats what will happen on the button, then sends ids chosen by name", async () => {
    renderDialog();
    fireEvent.click(await pickArtwork(/Vessel Study/));
    fireEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: /^2 editions/ }),
    );
    expect(
      within(dialog()).getByRole("button", { name: "Authorise 2 editions" }),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog()).getByLabelText(/Evidence note/), {
      target: { value: "  Signed consignment agreement  " },
    });

    fireEvent.click(within(dialog()).getByRole("button", { name: "Authorise 2 editions" }));

    await waitFor(() => expect(grantArtworkSaleAuthority).toHaveBeenCalledTimes(1));
    expect(grantArtworkSaleAuthority).toHaveBeenCalledWith({
      artworkId: "a-1",
      ownerPartyId: "p-1",
      authorisedCount: 2,
      evidenceNote: "Signed consignment agreement",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("offers to sign in again when the grant needs a recent sign-in", async () => {
    grantArtworkSaleAuthority.mockResolvedValue({
      ok: false,
      kind: "step_up_required",
      message: "Recent authentication is required for this action",
    });
    renderDialog();
    fireEvent.click(await pickArtwork(/Vessel Study/));
    fireEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: /^1 edition/ }),
    );
    fireEvent.change(within(dialog()).getByLabelText(/Evidence note/), {
      target: { value: "Agreement" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Authorise 1 edition" }));

    expect(
      await within(dialog()).findByRole("link", { name: "Sign in again" }),
    ).toBeInTheDocument();
  });
});
