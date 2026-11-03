import "server-only";

import { getServerMyAddresses } from "@/lib/data/http/addresses.server";
import { getServerInvoiceDetails } from "@/lib/data/http/organisation-team.server";
import { type DeliveryAddress, deliveryAddresses } from "./delivery-addresses.vm";

/**
 * The addresses a payer can have a courier quote for: their saved delivery addresses and, for an
 * organisation, its invoice address. A read that fails leaves that source out; the picker still
 * lets the payer add an address.
 */
export async function loadDeliveryAddresses(
  organisationId: string | null,
): Promise<DeliveryAddress[]> {
  const [book, invoice] = await Promise.all([
    getServerMyAddresses(),
    organisationId ? getServerInvoiceDetails(organisationId).catch(() => null) : null,
  ]);
  return deliveryAddresses({ book, invoice: invoice?.address ?? null });
}
