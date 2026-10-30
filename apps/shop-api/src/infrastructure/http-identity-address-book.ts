import { accountAddressResultSchema, accountAddressesSchema } from "@auction/identity-contracts";
import type { SavedDeliveryAddress } from "@auction/shop-contracts";
import type { DeliveryAddressBook } from "../application/ports/delivery-address-book.port.js";
import {
  type IdentityMachineClientConfig,
  createIdentityMachineClient,
} from "./identity-machine-client.js";

export type HttpIdentityAddressBookConfig = IdentityMachineClientConfig;

/**
 * The LAX-wide address book through Identity's machine routes
 * (`/internal/identity/subjects/:subjectId/addresses`). shop-api has already authenticated the
 * shopper, so the subject comes from the verified session, never from the request body.
 */
export function createHttpIdentityAddressBook(
  config: HttpIdentityAddressBookConfig,
): DeliveryAddressBook {
  const identity = createIdentityMachineClient(config);
  const path = (subject: string) => `/identity/subjects/${encodeURIComponent(subject)}/addresses`;

  return {
    async list(subject) {
      const parsed = accountAddressesSchema.safeParse(await identity.request("GET", path(subject)));
      if (!parsed.success) throw new Error("Identity address book returned an invalid list");
      return parsed.data.addresses.map(
        (address): SavedDeliveryAddress => ({
          id: address.id,
          label: address.label,
          recipientName: address.recipientName,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          postcode: address.postcode,
          country: address.country,
          phone: address.phone,
          isDefaultShipping: address.isDefaultShipping,
        }),
      );
    },
    async add(subject, address) {
      const parsed = accountAddressResultSchema.safeParse(
        await identity.request("POST", path(subject), {
          address: { ...address, region: null },
        }),
      );
      if (!parsed.success) throw new Error("Identity address book returned an invalid address");
    },
  };
}
