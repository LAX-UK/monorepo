// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminStockLocation } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addStockLocation = vi.fn();
const saveStockLocation = vi.fn();
const setStockLocationStatus = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-stock-location-actions.server", () => ({
  addStockLocation,
  saveStockLocation,
  setStockLocationStatus,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/from-zoho",
  useSearchParams: () => new URLSearchParams("tab=locations"),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { LocationsList } = await import("./locations-list.client");

const ADMIN = ["artwork_register.read", "artwork_location.read", "artwork_location.manage"];
const READ_ONLY = ["artwork_register.read", "artwork_location.read"];

function location(
  n: number,
  name: string,
  status: "active" | "retired" = "active",
): AdminStockLocation {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    name,
    note: n === 1 ? "By the loading bay" : null,
    status,
    label: status === "retired" ? `${name} (retired)` : name,
    version: 3,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-10T14:30:00.000Z",
    retiredAt: status === "retired" ? "2026-11-10T14:30:00.000Z" : null,
  };
}

const LOCATIONS = [
  location(1, "Store room"),
  location(2, "Gallery, main room"),
  location(3, "Framer", "retired"),
];

function show(locations: AdminStockLocation[], capabilities = ADMIN, role = "Administrator") {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, role)}>
        <LocationsList
          query={{ tab: "locations" }}
          counts={{ new: 4, decisions: 2 }}
          locations={locations}
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const rowOf = (name: string) => {
  const row = screen
    .getAllByText(name)
    .map((match) => match.closest("tr"))
    .find((candidate) => candidate !== null);
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("From Zoho › Locations", () => {
  it("lists each place with its note and status, under the From Zoho tabs", () => {
    show(LOCATIONS);
    expect(screen.getByRole("link", { name: "Locations" })).toHaveAttribute("aria-current", "page");
    expect(rowOf("Store room").getByText("By the loading bay")).toBeInTheDocument();
    expect(rowOf("Store room").getByText("Active")).toBeInTheDocument();
    expect(rowOf("Framer").getByText("Retired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add location" })).toBeInTheDocument();
  });

  it("offers retire for an active place and restore for a retired one", () => {
    show(LOCATIONS);
    expect(rowOf("Store room").getByRole("menuitem", { name: "Retire…" })).toBeInTheDocument();
    expect(rowOf("Framer").getByRole("menuitem", { name: "Restore…" })).toBeInTheDocument();
    expect(rowOf("Framer").queryByRole("menuitem", { name: "Retire…" })).toBeNull();
  });

  it("is read-only for a role that cannot keep the list: no add, no row menu, no dialog", () => {
    show(LOCATIONS, READ_ONLY, "Catalogue editor");
    expect(screen.queryByRole("button", { name: "Add location" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Edit…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Retire…" })).toBeNull();
    expect(screen.getByText(/View only/)).toBeInTheDocument();
    fireEvent.click(rowOf("Store room").getByText("Store room"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains an empty list, with Add location for an Administrator only", () => {
    const { unmount } = show([]);
    expect(screen.getByText("No locations yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add location" })).toBeInTheDocument();
    unmount();
    show([], READ_ONLY, "Catalogue editor");
    expect(screen.getByText(/An Administrator adds the places/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add location" })).toBeNull();
  });
});

describe("adding and renaming a location", () => {
  it("lists every field the API refused at the top and beside each field", async () => {
    addStockLocation.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "Give the location a name.",
      issues: [
        { field: "name", message: "Give the location a name." },
        { field: "note", message: "Keep the note to 200 characters or fewer." },
      ],
    });
    show(LOCATIONS);
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add location" }));
    fireEvent.change(dialog.getByLabelText(/^Note/), { target: { value: "x".repeat(201) } });
    fireEvent.click(dialog.getByRole("button", { name: "Add location" }));
    expect(await dialog.findByText("Name: Give the location a name.")).toBeInTheDocument();
    expect(dialog.getByText("Note: Keep the note to 200 characters or fewer.")).toBeInTheDocument();
    // The dialog stays open on what was typed.
    expect(screen.getByRole("dialog", { name: "Add location" })).toBeInTheDocument();
  });

  it("adds the name as typed with no note; shop-api trims it", async () => {
    addStockLocation.mockResolvedValue({
      ok: true,
      data: { changed: true, location: location(4, "On loan") },
    });
    show(LOCATIONS);
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add location" }));
    fireEvent.change(dialog.getByLabelText(/^Name/), { target: { value: "  On loan " } });
    fireEvent.click(dialog.getByRole("button", { name: "Add location" }));
    await waitFor(() => expect(addStockLocation).toHaveBeenCalledOnce());
    expect(addStockLocation.mock.calls[0]?.[0]).toMatchObject({ name: "  On loan ", note: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens the edit dialog from the row, and saves against the version it opened", async () => {
    saveStockLocation.mockResolvedValue({
      ok: true,
      data: { changed: true, location: location(1, "Store room B") },
    });
    show(LOCATIONS);
    fireEvent.click(rowOf("Store room").getByText("Store room"));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit Store room" }));
    expect(dialog.getByLabelText(/^Note/)).toHaveValue("By the loading bay");
    fireEvent.change(dialog.getByLabelText(/^Name/), { target: { value: "Store room B" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save location" }));
    await waitFor(() => expect(saveStockLocation).toHaveBeenCalledOnce());
    expect(saveStockLocation.mock.calls[0]?.[0]).toMatchObject({
      locationId: LOCATIONS[0]?.id,
      expectedVersion: 3,
      name: "Store room B",
      note: "By the loading bay",
    });
  });

  it("says someone else changed it, keeps what was typed and offers Reload", async () => {
    saveStockLocation.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This location was changed by someone else since it was opened",
      currentVersion: "4",
    });
    show(LOCATIONS);
    fireEvent.click(rowOf("Store room").getByText("Store room"));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit Store room" }));
    fireEvent.change(dialog.getByLabelText(/^Name/), { target: { value: "Back store" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save location" }));
    expect(await dialog.findByText("Someone else changed this location")).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Name/)).toHaveValue("Back store");
    fireEvent.click(dialog.getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
    expect(dialog.queryByText("Someone else changed this location")).toBeNull();
  });

  it("puts a name in use beside the field, with no Reload", async () => {
    addStockLocation.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "Another location already has this name.",
      code: "shop.conflict",
    });
    show(LOCATIONS);
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add location" }));
    fireEvent.change(dialog.getByLabelText(/^Name/), { target: { value: "Basement" } });
    fireEvent.click(dialog.getByRole("button", { name: "Add location" }));
    expect(
      await dialog.findByText("Name: Another location already has this name."),
    ).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Reload" })).toBeNull();
  });

  it("shows a reused key's 409 as the action's error, not as a name in use", async () => {
    addStockLocation.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This request was already made with different details.",
      code: "shop.idempotency_conflict",
    });
    show(LOCATIONS);
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add location" }));
    fireEvent.change(dialog.getByLabelText(/^Name/), { target: { value: "Basement" } });
    fireEvent.click(dialog.getByRole("button", { name: "Add location" }));
    expect(
      await dialog.findByText("This request was already made with different details."),
    ).toBeInTheDocument();
    expect(dialog.queryByText(/Another location already has this name/)).toBeNull();
    expect(dialog.getByLabelText(/^Name/)).not.toHaveAttribute("aria-invalid", "true");
  });
});

describe("retiring and restoring", () => {
  it("asks first, then retires with the version it read", async () => {
    setStockLocationStatus.mockResolvedValue({
      ok: true,
      data: { changed: true, location: location(1, "Store room", "retired") },
    });
    show(LOCATIONS);
    fireEvent.click(rowOf("Store room").getByRole("menuitem", { name: "Retire…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Retire Store room?" }));
    expect(dialog.getByText(/Artworks already here keep it/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Retire location" }));
    await waitFor(() => expect(setStockLocationStatus).toHaveBeenCalledOnce());
    expect(setStockLocationStatus.mock.calls[0]?.[0]).toMatchObject({
      locationId: LOCATIONS[0]?.id,
      expectedVersion: 3,
      status: "retired",
    });
  });

  it("restores a retired place", async () => {
    setStockLocationStatus.mockResolvedValue({
      ok: true,
      data: { changed: true, location: location(3, "Framer") },
    });
    show(LOCATIONS);
    fireEvent.click(rowOf("Framer").getByRole("menuitem", { name: "Restore…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Restore Framer?" }));
    fireEvent.click(dialog.getByRole("button", { name: "Restore location" }));
    await waitFor(() =>
      expect(setStockLocationStatus.mock.calls[0]?.[0]).toMatchObject({ status: "active" }),
    );
  });
});
