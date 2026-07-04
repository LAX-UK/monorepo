import type { legalEntity } from "@auction/db/schema";
import type { ConnectAddressSnapshot, ConnectKycSnapshot } from "@auction/persistence/lib";
import type Stripe from "stripe";
import { normalizeConnectCountryCode } from "./connect-country-resolver.js";

/** Controller config is always provided by the caller (Custom embedded accounts). */
export type ConnectAccountController = NonNullable<Stripe.AccountCreateParams["controller"]>;

export type { ConnectKycSnapshot };

export type ConnectOwnerSnapshot = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  mobile: string | null;
};

type EntityRow = typeof legalEntity.$inferSelect;

function stripeAddressFromSnapshot(
  snapshot: ConnectAddressSnapshot,
  country: string,
): Stripe.AddressParam {
  const address: Stripe.AddressParam = {
    line1: snapshot.line1,
    city: snapshot.city,
    postal_code: snapshot.postalCode,
    country,
  };
  const line2 = snapshot.line2?.trim();
  if (line2) address.line2 = line2;
  const state = snapshot.state?.trim();
  if (state) address.state = state;
  return address;
}

function dobFromIsoDate(isoDate: string | null): Stripe.AccountCreateParams.Individual.Dob | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function resolveIndividualNames(
  owner: ConnectOwnerSnapshot,
  kyc: ConnectKycSnapshot | null,
): { first: string; last: string } {
  const display = owner.displayName?.trim() || "";
  const parts = display.split(/\s+/).filter(Boolean);
  const fromDisplay = parts.length > 0 ? parts[0] : undefined;
  const fromEmail = owner.email.split("@")[0];
  const first =
    kyc?.verifiedFirstName?.trim() ||
    owner.firstName?.trim() ||
    fromDisplay ||
    (fromEmail !== "" ? fromEmail : undefined) ||
    "Seller";
  const last =
    kyc?.verifiedLastName?.trim() ||
    owner.lastName?.trim() ||
    (parts.length > 1 ? parts.slice(1).join(" ") : "") ||
    first ||
    "Individual";
  return { first: first.slice(0, 100), last: last.slice(0, 100) };
}

function pickAddressForPrefill(
  entityAddress: ConnectAddressSnapshot | null,
  userAddress: ConnectAddressSnapshot | null,
  country: string,
): Stripe.AddressParam | null {
  const snapshot = entityAddress ?? userAddress;
  if (!snapshot) return null;
  const addressCountry = normalizeConnectCountryCode(snapshot.country) ?? country;
  return stripeAddressFromSnapshot(snapshot, addressCountry);
}

export function buildIndividualConnectAccountParams(input: {
  country: string;
  legalEntityId: string;
  subkind: EntityRow["subkind"];
  owner: ConnectOwnerSnapshot;
  kyc: ConnectKycSnapshot | null;
  entityAddress: ConnectAddressSnapshot | null;
  userAddress: ConnectAddressSnapshot | null;
  controller: ConnectAccountController;
}): Stripe.AccountCreateParams {
  const names = resolveIndividualNames(input.owner, input.kyc);
  const individual: Stripe.AccountCreateParams.Individual = {
    first_name: names.first,
    last_name: names.last,
    email: input.owner.email,
  };

  const address = pickAddressForPrefill(input.entityAddress, input.userAddress, input.country);
  if (address) individual.address = address;

  const dob = dobFromIsoDate(input.kyc?.verifiedDateOfBirth ?? null);
  if (dob) individual.dob = dob;

  const phone = input.owner.mobile?.trim();
  if (phone) individual.phone = phone;

  return {
    country: input.country,
    controller: input.controller,
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
    individual,
    metadata: { legalEntityId: input.legalEntityId, subkind: input.subkind },
  };
}

export function buildOrganisationConnectAccountParams(input: {
  country: string;
  legalEntityId: string;
  row: EntityRow;
  entityAddress: ConnectAddressSnapshot | null;
  controller: ConnectAccountController;
}): Stripe.AccountCreateParams {
  const params: Stripe.AccountCreateParams = {
    country: input.country,
    controller: input.controller,
    capabilities: { transfers: { requested: true } },
    business_type: input.row.subkind === "charity" ? "non_profit" : "company",
    metadata: { legalEntityId: input.legalEntityId, subkind: input.row.subkind },
  };

  const businessProfile: Stripe.AccountCreateParams.BusinessProfile = {};
  if (input.row.legalName?.trim()) {
    businessProfile.name = input.row.legalName.trim();
  }
  if (Object.keys(businessProfile).length > 0) {
    params.business_profile = businessProfile;
  }

  if (input.entityAddress) {
    const addressCountry =
      normalizeConnectCountryCode(input.entityAddress.country) ?? input.country;
    params.company = {
      address: stripeAddressFromSnapshot(input.entityAddress, addressCountry),
    };
  }

  const taxId = input.row.vatNumber?.trim();
  if (taxId) {
    params.company = { ...params.company, tax_id: taxId };
  }

  return params;
}
