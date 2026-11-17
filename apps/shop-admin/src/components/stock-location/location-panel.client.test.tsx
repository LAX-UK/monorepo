// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminArtworkLocation, AdminStockLocation } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const moveArtworksToLocation = vi.fn();
const refresh = vi.fn();
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));

vi.mock("@/server/application/admin-stock-location-actions.server", () => ({
  moveArtworksToLocation,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/from-zoho/r",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { LocationPanel } = await import("./location-panel.client");

const REGISTER_ID = "00000000-0000-4000-8000-0000000000aa";
const ROOM = "11111111-1111-4111-8111-111111111111";
const FRAMER = "22222222-2222-4222-8222-222222222222";
const MOVER = ["artwork_register.read", "artwork_location.read", "artwork_location.move"];
const READER = ["artwork_register.read", "artwork_location.read"];

const ref = (id: string, name: string, status: "active" | "retired" = "active") => ({
  id,
  name,
  status,
  label: status === "retired" ? `${name} (retired)` : name,
});

const list = (id: string, name: string, status: "active" | "retired"): AdminStockLocation => ({
  id,
  name,
  note: null,
  status,
  label: status === "retired" ? `${name} (retired)` : name,
  version: 1,
  createdAt: "2026-11-01T09:00:00.000Z",
  updatedAt: "2026-11-01T09:00:00.000Z",
  retiredAt: null,
});
const LOCATIONS = [list(ROOM, "Store room", "active"), list(FRAMER, "Framer", "retired")];

const AT_ROOM: AdminArtworkLocation = {
  registerId: REGISTER_ID,
  label: "Store room",
  current: {
    location: ref(ROOM, "Store room"),
    movedAt: "2026-11-17T10:00:00.000Z",
    movedBy: "staff:ops-1",
    movedByName: "Ana Ruiz",
  },
  moves: [
    {
      id: "m2",
      from: ref(FRAMER, "Framer", "retired"),
      to: ref(ROOM, "Store room"),
      movedAt: "2026-11-17T10:00:00.000Z",
      movedBy: "staff:ops-1",
      movedByName: "Ana Ruiz",
      note: "Back from framing",
    },
    {
      id: "m1",
      from: null,
      to: ref(FRAMER, "Framer", "retired"),
      movedAt: "2026-11-10T10:00:00.000Z",
      movedBy: "staff:gone",
      movedByName: null,
      note: null,
    },
  ],
  moreMoves: false,
};

const NOWHERE: AdminArtworkLocation = {
  registerId: REGISTER_ID,
  label: "Location not recorded",
  current: null,
  moves: [],
  moreMoves: false,
};

function show(
  location: AdminArtworkLocation | null,
  capabilities = MOVER,
  locations: AdminStockLocation[] | null = LOCATIONS,
) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Administrator")}>
        <LocationPanel
          registerId={REGISTER_ID}
          title="Salt marsh, dusk"
          location={location}
          locations={locations}
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the Location panel", () => {
  it("shows where the artwork is, who moved it there, and every move newest first", () => {
    show(AT_ROOM);
    const panel = screen;
    expect(panel.getByText("Store room", { selector: "span" })).toBeInTheDocument();
    expect(panel.getByText(/by Ana Ruiz/)).toBeInTheDocument();
    const history = within(panel.getByRole("list", { name: "Location history" }));
    const items = history.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(
      within(items[0] as HTMLElement).getByText("Framer (retired) → Store room"),
    ).toBeVisible();
    expect(within(items[0] as HTMLElement).getByText("Back from framing")).toBeVisible();
    expect(
      within(items[1] as HTMLElement).getByText("First recorded at Framer (retired)"),
    ).toBeVisible();
    expect(within(items[1] as HTMLElement).getByText(/LAX staff/)).toBeVisible();
  });

  it("reads Location not recorded with no moves yet", () => {
    show(NOWHERE);
    expect(screen.getByText("Location not recorded")).toBeInTheDocument();
    expect(screen.getByText("No moves recorded yet.")).toBeInTheDocument();
  });

  it("says older moves are kept when the history is capped", () => {
    show({ ...AT_ROOM, moreMoves: true });
    expect(screen.getByText("Showing the latest 2 moves. Older moves are kept.")).toBeVisible();
  });

  it("says the location did not load, with Try again", () => {
    show(null);
    expect(screen.getByText("The location did not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("gives Move only to people who can move artworks", () => {
    show(AT_ROOM, READER);
    expect(screen.queryByRole("button", { name: "Move…" })).toBeNull();
  });

  it("moves the artwork to an active place, saying where it is now", async () => {
    moveArtworksToLocation.mockResolvedValue({
      ok: true,
      data: {
        locationId: ROOM,
        moved: [],
        unchanged: [REGISTER_ID],
        notFound: [],
      },
    });
    show(AT_ROOM);
    fireEvent.click(screen.getByRole("button", { name: "Move…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Move Salt marsh, dusk" }));
    expect(dialog.getByText("Where it is now: Store room.")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Store room/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Move artwork" }));
    await waitFor(() => expect(moveArtworksToLocation).toHaveBeenCalledOnce());
    expect(moveArtworksToLocation.mock.calls[0]?.[0]).toMatchObject({
      body: { registerIds: [REGISTER_ID], locationId: ROOM, note: null },
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Already at Store room"));
  });

  it("reloads the places when the one chosen was retired meanwhile, and says so", async () => {
    moveArtworksToLocation.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This location has been retired. Choose another.",
    });
    show(NOWHERE);
    fireEvent.click(screen.getByRole("button", { name: "Move…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Move Salt marsh, dusk" }));
    fireEvent.click(dialog.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Store room" }));
    fireEvent.click(dialog.getByRole("button", { name: "Move artwork" }));
    expect(
      await dialog.findByText("This location has been retired. Choose another."),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a note the API refused beside the Note field and in the summary", async () => {
    moveArtworksToLocation.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "Keep the note to 500 characters or fewer.",
      issues: [{ field: "note", message: "Keep the note to 500 characters or fewer." }],
    });
    show(NOWHERE);
    fireEvent.click(screen.getByRole("button", { name: "Move…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Move Salt marsh, dusk" }));
    fireEvent.click(dialog.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Store room" }));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "x".repeat(501) } });
    fireEvent.click(dialog.getByRole("button", { name: "Move artwork" }));
    expect(
      await dialog.findByText("Note: Keep the note to 500 characters or fewer."),
    ).toBeInTheDocument();
    expect(dialog.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("says there is nowhere to move to while no place is active", async () => {
    show(NOWHERE, MOVER, [list(FRAMER, "Framer", "retired")]);
    fireEvent.click(screen.getByRole("button", { name: "Move…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Move Salt marsh, dusk" }));
    expect(dialog.getByText("No locations to move to")).toBeInTheDocument();
  });
});
