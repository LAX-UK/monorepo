import type { AccountAddressDefaultKind, AccountAddressFields } from "@auction/identity-contracts";

export type IdentityAddressRow = AccountAddressFields & {
  id: string;
  subjectId: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AddressWriteOutcome =
  | { ok: true; address: IdentityAddressRow }
  | { ok: false; reason: "address_not_found" | "version_conflict" };

export type AddressCreateOutcome =
  | { ok: true; address: IdentityAddressRow }
  | { ok: false; reason: "address_limit_reached" };

export type AddressDeleteOutcome =
  | { ok: true }
  | { ok: false; reason: "address_not_found" | "version_conflict" };

/**
 * Persistence for the address book. Each method is atomic for one person: concurrent changes
 * to the same person's addresses are serialised, so the limit and the one-default-per-kind rule
 * hold even when two tabs act at once.
 */
export interface IIdentityAddressRepository {
  list(subjectId: string): Promise<IdentityAddressRow[]>;
  /** The first address a person saves becomes both of their defaults. */
  create(
    subjectId: string,
    fields: AccountAddressFields,
    limit: number,
  ): Promise<AddressCreateOutcome>;
  update(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
    fields: AccountAddressFields,
  ): Promise<AddressWriteOutcome>;
  /** Deleting a default promotes the person's oldest remaining address to that default. */
  delete(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
  ): Promise<AddressDeleteOutcome>;
  setDefault(
    subjectId: string,
    addressId: string,
    kind: AccountAddressDefaultKind,
  ): Promise<AddressWriteOutcome>;
}
