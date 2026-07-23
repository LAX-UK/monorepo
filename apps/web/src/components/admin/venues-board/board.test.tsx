import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminVenuesBoard } from "./board";

vi.mock("@/lib/actions/admin-venues", () => ({
  adminArchiveVenueResultAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const venue = {
  id: "venue-1",
  legalEntityId: "entity-1",
  legalEntityDisplayName: "LAX Gallery",
  name: "Mayfair",
  slug: "mayfair",
  addressLine1: "1 Art Street",
  addressLine2: null,
  city: "London",
  county: null,
  postcode: "W1 1AA",
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
  status: "active" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("AdminVenuesBoard", () => {
  it("uses the standard directory table and count badge", () => {
    render(<AdminVenuesBoard venues={[venue]} listTotalCount={12} />);

    expect(screen.getByRole("heading", { name: "Venue directory" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Venue directory" })).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
