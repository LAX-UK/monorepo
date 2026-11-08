import type {
  AdminDeliveryRegions,
  DeliveryCountry,
  DeliveryRegionView,
  PublicDeliveryRegions,
} from "@auction/shop-contracts";
import {
  DELIVERY_REGION_COUNTRIES,
  type DeliveryRegion,
  ISO_COUNTRY_CODES,
} from "@auction/shop-domain";
import type { DeliveryRegionsState } from "../application/delivery-regions/delivery-regions.ports.js";

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

/** A country as buyers and staff read it: "Germany", never just "DE". */
function countryOf(code: string): DeliveryCountry {
  return { code, name: regionNames.of(code) ?? code };
}

const byName = (a: DeliveryCountry, b: DeliveryCountry) => a.name.localeCompare(b.name, "en-GB");

function regionOf(region: DeliveryRegion): DeliveryRegionView {
  return {
    id: region.id,
    name: region.name,
    standard: region.standard,
    specialist: region.specialist,
    fixedPricePence: region.fixedPricePence,
    countries: [...DELIVERY_REGION_COUNTRIES[region.id]],
  };
}

/** What the storefront reads to decide how a delivery address is handled. */
export function presentPublicDeliveryRegions(state: DeliveryRegionsState): PublicDeliveryRegions {
  return {
    regions: state.regions.map(regionOf),
    notDeliveredTo: state.restrictedCountries.map(countryOf).sort(byName),
  };
}

/** What LAX Admin edits: the same, and every country the restricted list can name. */
export function presentAdminDeliveryRegions(state: DeliveryRegionsState): AdminDeliveryRegions {
  return {
    ...presentPublicDeliveryRegions(state),
    countryChoices: ISO_COUNTRY_CODES.filter((code) => code !== "GB")
      .map(countryOf)
      .sort(byName),
  };
}
