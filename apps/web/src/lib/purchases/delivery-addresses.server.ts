import "server-only";

import { getServerMyAddresses } from "@/lib/data/http/addresses.server";
import {
  getServerInvoiceDetails,
  getServerOrganisationAddresses,
} from "@/lib/data/http/organisation-team.server";
import {
  type AddressContext,
  type DeliveryAddress,
  deliveryAddresses,
} from "./delivery-addresses.vm";

/**
 * The addresses a payer can have a courier quote for: for an organisation, its registered and
 * delivery addresses and its invoice address; always the member's saved delivery addresses. A
 * read that fails leaves that source out (and the organisation's says so); the picker still lets
 * the payer add an address.
 */
export async function loadDeliveryAddresses(
  organisation: { id: string; name: string } | null,
): Promise<{ addresses: DeliveryAddress[]; context: AddressContext | null }> {
  const [book, invoice, owned] = await Promise.all([
    getServerMyAddresses(),
    organisation ? getServerInvoiceDetails(organisation.id).catch(() => null) : null,
    organisation ? getServerOrganisationAddresses(organisation.id).catch(() => null) : null,
  ]);
  return {
    addresses: deliveryAddresses({
      book,
      invoice: invoice?.address ?? null,
      organisation: owned?.addresses ?? [],
    }),
    context: organisation
      ? {
          organisationId: organisation.id,
          organisationName: organisation.name,
          canAdd: owned?.canAdd ?? false,
          loadFailed: owned === null,
        }
      : null,
  };
}
