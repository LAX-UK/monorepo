import { AdminVenueForm } from "@/components/admin/venue-form";
import type { Venue } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, createMock, updateMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/admin/venues/new",
}));
vi.mock("@/lib/actions/admin-venues", () => ({
  adminCreateVenueResultAction: (...args: unknown[]) => createMock(...args),
  adminUpdateVenueResultAction: (...args: unknown[]) => updateMock(...args),
}));
vi.mock("@/lib/admin/pickers/staff-entity-search", () => ({
  searchLegalEntityOptions: vi.fn(async () => []),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const ENTITY_ID = "6f1c0c1e-8a2b-4d0e-9a54-2b7a4f6f3c11";

const venue: Venue = {
  id: "venue-1",
  legalEntityId: ENTITY_ID,
  name: "LAX Mayfair Saleroom",
  slug: "lax-mayfair-saleroom",
  addressLine1: "12 King Street",
  addressLine2: null,
  city: "London",
  county: null,
  postcode: "SW1Y 6QU",
  country: "United Kingdom",
  mapUrl: null,
  latitude: null,
  longitude: null,
  openingHours: null,
  contactPhone: null,
  contactEmail: null,
  website: null,
  photos: [],
  capacity: null,
  accessNotes: null,
  parkingNotes: null,
  directionsNotes: null,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("AdminVenueForm", () => {
  beforeEach(() => {
    for (const fn of [pushMock, createMock, updateMock]) fn.mockReset();
  });

  it("lists what is missing, by field, when a new venue is submitted empty", async () => {
    render(<AdminVenueForm mode="create" platformLegalEntityId={null} />);
    const submit = screen.getByRole("button", { name: "Create venue" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await screen.findByRole("alert", { name: "There is a problem" });
    expect(screen.getAllByText("Enter the venue's name")).toHaveLength(2);
    expect(screen.getAllByText("Choose the organisation that runs this venue")).toHaveLength(2);
    expect(screen.getAllByText("Enter a valid UK postcode, like SW1Y 6QU")).toHaveLength(2);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("explains a latitude that is out of range, on that field", async () => {
    render(<AdminVenueForm mode="edit" venue={venue} salesUsingCount={0} />);
    fireEvent.change(screen.getByLabelText(/Latitude/), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findAllByText("Latitude must be between -90 and 90")).toHaveLength(2);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("saves the venue with the text converted, then opens its page", async () => {
    updateMock.mockResolvedValue({ ok: true });
    render(<AdminVenueForm mode="edit" venue={venue} salesUsingCount={0} />);
    fireEvent.change(screen.getByLabelText(/Capacity/), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText(/Photo links/), {
      target: { value: "https://example.com/a.jpg\nhttps://example.com/b.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/venues/venue-1"));
    expect(updateMock).toHaveBeenCalledWith(
      "venue-1",
      expect.objectContaining({
        capacity: 250,
        photos: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
        postcode: "SW1Y 6QU",
      }),
    );
  });

  it("locks the organisation while sales use the venue", () => {
    render(
      <AdminVenueForm
        mode="edit"
        venue={venue}
        legalEntityDisplayName="London Art Exchange Ltd"
        salesUsingCount={2}
      />,
    );
    expect(screen.getByText("Cannot be changed while sales use this venue.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Organisation/ })).toBeDisabled();
  });

  it("keeps the form and says why when the save is refused", async () => {
    updateMock.mockResolvedValue({ ok: false, error: "Could not save the venue." });
    render(<AdminVenueForm mode="edit" venue={venue} salesUsingCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Could not save the venue.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
