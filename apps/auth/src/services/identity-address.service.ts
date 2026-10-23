import {
  ACCOUNT_ADDRESS_LIMIT,
  type AccountAddressDefaultKind,
  type AccountAddressFields,
} from "@auction/identity-contracts";
import type {
  AddressCreateOutcome,
  AddressDeleteOutcome,
  AddressWriteOutcome,
  IIdentityAddressRepository,
  IdentityAddressRow,
} from "./identity-address.ports.js";

/**
 * The LAX-wide address book of one person. Callers have already authenticated and validated
 * the input: LAX Account through its client-authenticated routes (with a recent sign-in for
 * changes), products through the machine-authenticated internal routes.
 */
export class IdentityAddressService {
  constructor(private readonly addresses: IIdentityAddressRepository) {}

  list(subjectId: string): Promise<IdentityAddressRow[]> {
    return this.addresses.list(subjectId);
  }

  create(subjectId: string, fields: AccountAddressFields): Promise<AddressCreateOutcome> {
    return this.addresses.create(subjectId, fields, ACCOUNT_ADDRESS_LIMIT);
  }

  update(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
    fields: AccountAddressFields,
  ): Promise<AddressWriteOutcome> {
    return this.addresses.update(subjectId, addressId, expectedVersion, fields);
  }

  delete(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
  ): Promise<AddressDeleteOutcome> {
    return this.addresses.delete(subjectId, addressId, expectedVersion);
  }

  setDefault(
    subjectId: string,
    addressId: string,
    kind: AccountAddressDefaultKind,
  ): Promise<AddressWriteOutcome> {
    return this.addresses.setDefault(subjectId, addressId, kind);
  }
}
