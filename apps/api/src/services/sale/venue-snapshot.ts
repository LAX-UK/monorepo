import type { IVenueRepository } from "@auction/persistence/interfaces";
import type { CreateSaleInput, Venue } from "@auction/types";
import { formatPostalAddress } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { LotError } from "../../lib/errors.js";

export function venueLocationSnapshot(venue: Venue): Partial<CreateSaleInput> {
  const locationAddressLine1 = venue.addressLine1;
  const locationAddressLine2 = venue.addressLine2;
  const locationCity = venue.city;
  const locationCounty = venue.county;
  const locationPostcode = venue.postcode;
  const locationCountry = venue.country;
  const locationAddress = formatPostalAddress({
    locationAddressLine1,
    locationAddressLine2,
    locationCity,
    locationCounty,
    locationPostcode,
    locationCountry,
  });
  return {
    venueId: venue.id,
    locationName: venue.name,
    locationAddress: locationAddress || null,
    locationMapUrl: venue.mapUrl,
    locationAddressLine1,
    locationAddressLine2,
    locationCity,
    locationCounty,
    locationPostcode,
    locationCountry,
  };
}

export async function applyVenueSnapshot(
  venueRepository: IVenueRepository | null,
  input: Partial<CreateSaleInput>,
  options: {
    saleLegalEntityId: string;
    existingVenueId?: string | null;
    snapshotAddress: boolean;
  },
): Promise<Result<Partial<CreateSaleInput>, LotError>> {
  const venueId = input.venueId !== undefined ? input.venueId : options.existingVenueId;
  if (!venueId) return ok(input);
  if (!venueRepository) {
    return err(new LotError("Venue repository is not configured", 500));
  }
  const venue = await venueRepository.findById(venueId);
  if (!venue) return err(new LotError("Venue not found", 404, "venue_not_found"));
  if (venue.legalEntityId !== options.saleLegalEntityId) {
    return err(
      new LotError("Venue does not belong to this organisation", 403, "venue_org_mismatch"),
    );
  }
  if (venue.status !== "active") {
    return err(new LotError("Archived venues cannot be assigned to sales", 409, "venue_archived"));
  }
  if (!options.snapshotAddress) {
    return ok({ ...input, venueId });
  }
  return ok({ ...input, ...venueLocationSnapshot(venue) });
}
