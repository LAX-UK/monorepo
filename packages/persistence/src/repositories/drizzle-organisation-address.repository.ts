import type { Database } from "@auction/db";
import { legalEntityAddress } from "@auction/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  IOrganisationAddressRepository,
  InvoiceAddress,
  OrganisationAddress,
} from "../interfaces/organisation-team.readers.js";

/** The `address_type` of an address added for deliveries; registration writes the others. */
export const DELIVERY_ADDRESS_TYPE = "delivery";

/** Registration stores the registered address as either of these. */
const REGISTERED_TYPES = ["registered_office", "both"];

/** More than a buyer can sensibly choose from; the list is not paged. */
const MAX_DELIVERY_ADDRESSES = 20;

type Row = typeof legalEntityAddress.$inferSelect;

function toAddress(row: Row): OrganisationAddress {
  return {
    id: row.id,
    kind: row.addressType === DELIVERY_ADDRESS_TYPE ? "delivery" : "registered",
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.state,
    postalCode: row.postalCode,
    country: row.country,
  };
}

/** An organisation's registered address and the delivery addresses added for it. */
export class DrizzleOrganisationAddressRepository implements IOrganisationAddressRepository {
  constructor(private readonly db: Database) {}

  async list(legalEntityId: string): Promise<OrganisationAddress[]> {
    const [registered] = await this.db
      .select()
      .from(legalEntityAddress)
      .where(
        and(
          eq(legalEntityAddress.legalEntityId, legalEntityId),
          inArray(legalEntityAddress.addressType, REGISTERED_TYPES),
        ),
      )
      .orderBy(desc(legalEntityAddress.isDefault), asc(legalEntityAddress.createdAt))
      .limit(1);
    const delivery = await this.db
      .select()
      .from(legalEntityAddress)
      .where(
        and(
          eq(legalEntityAddress.legalEntityId, legalEntityId),
          eq(legalEntityAddress.addressType, DELIVERY_ADDRESS_TYPE),
        ),
      )
      .orderBy(asc(legalEntityAddress.createdAt), asc(legalEntityAddress.id))
      .limit(MAX_DELIVERY_ADDRESSES);
    return [...(registered ? [registered] : []), ...delivery].map(toAddress);
  }

  async addDelivery(legalEntityId: string, address: InvoiceAddress): Promise<OrganisationAddress> {
    const [row] = await this.db
      .insert(legalEntityAddress)
      .values({
        legalEntityId,
        addressType: DELIVERY_ADDRESS_TYPE,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.region,
        postalCode: address.postalCode,
        country: address.country,
        isDefault: false,
      })
      .returning();
    if (!row) throw new Error("organisation address insert returned no row");
    return toAddress(row);
  }
}
