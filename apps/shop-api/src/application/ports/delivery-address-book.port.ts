import type { SavedDeliveryAddress } from "@auction/shop-contracts";

/** A delivery address checkout asks the book to keep, in the book's own field names. */
export type DeliveryAddressToSave = {
  /** The name LAX Account lists the address under. */
  label: string;
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  phone: string | null;
};

/**
 * The person's LAX-wide address book, which Identity owns and LAX Account manages. Shop only
 * reads it at checkout and adds an address when the shopper asks it to. Both calls reject when
 * the book cannot be reached; callers decide what that means for the shopper.
 */
export interface DeliveryAddressBook {
  list(subject: string): Promise<SavedDeliveryAddress[]>;
  add(subject: string, address: DeliveryAddressToSave): Promise<void>;
}
