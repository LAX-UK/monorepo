import {
  type AccountAddress,
  type AccountAddressInput,
  countryToIso,
} from "@auction/identity-contracts";
import type {
  CreateAddressInput,
  IAddressRepository,
  UpdateAddressInput,
  UserAddressRow,
} from "@auction/persistence/interfaces";
import { LotError } from "../lib/errors.js";
import type { IIdentityAddressClient } from "../services/interfaces/identity-issuer-client.js";
import { IdentityIssuerClientError } from "./http-identity-issuer.client.js";

type Logger = { warn(context: Record<string, unknown>, message: string): void };

/**
 * Bid's saved addresses, served from the LAX-wide address book that Identity owns.
 *
 * Bid keeps its own shape on the wire (`state`, `postalCode`, one `isDefault`, an address type)
 * so the existing settings pages and checkout keep working: every address in the book can ship
 * and bill (`both`), and Bid's single default is the default shipping address.
 *
 * Addresses Bid saved before the book existed are still in the legacy table until the backfill
 * has copied them. They stay readable (and deletable) here so checkout can still resolve an
 * address id a person already holds, and so a book that cannot be reached degrades to the old
 * list instead of an empty one. New and edited addresses are written to the book only.
 */
export class IdentityAddressBookRepository implements IAddressRepository {
  constructor(
    private readonly book: IIdentityAddressClient,
    private readonly legacy: IAddressRepository,
    private readonly readName: (userId: string) => Promise<string | null>,
    private readonly log: Logger,
  ) {}

  async listByUser(userId: string): Promise<UserAddressRow[]> {
    const [book, legacy] = await Promise.all([
      this.book.listAddresses(userId).then(
        (addresses) => addresses,
        (error: unknown) => {
          this.log.warn({ err: error, userId }, "identity_address_book_unavailable");
          return null;
        },
      ),
      this.legacy.listByUser(userId),
    ]);
    if (!book) return legacy;
    const known = new Set(book.map((address) => address.id));
    const hasDefault = book.some((address) => address.isDefaultShipping);
    const unmigrated = legacy
      .filter((row) => !known.has(row.id))
      .map((row) => (hasDefault ? { ...row, isDefault: false } : row));
    return [...book.map((address) => toRow(userId, address)), ...unmigrated];
  }

  async findByIdForUser(userId: string, addressId: string): Promise<UserAddressRow | null> {
    return (await this.listByUser(userId)).find((row) => row.id === addressId) ?? null;
  }

  async create(userId: string, input: CreateAddressInput): Promise<UserAddressRow> {
    const fields = await this.toFields(userId, input);
    let created = await this.guarded(() => this.book.createAddress(userId, fields));
    created = await this.applyDefaults(userId, created, input.isDefault, input.addressType);
    return toRow(userId, created);
  }

  async update(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<UserAddressRow | null> {
    const current = (await this.book.listAddresses(userId)).find((a) => a.id === addressId);
    if (!current) return null;
    const fields = await this.toFields(
      userId,
      { ...toCreateInput(current), ...definedOnly(input) },
      current,
    );
    let updated = await this.guarded(() =>
      this.book.updateAddress(userId, addressId, current.version, fields),
    );
    updated = await this.applyDefaults(userId, updated, input.isDefault, input.addressType);
    return toRow(userId, updated);
  }

  async delete(userId: string, addressId: string): Promise<boolean> {
    const current = (await this.book.listAddresses(userId)).find((a) => a.id === addressId);
    if (!current) return this.legacy.delete(userId, addressId);
    try {
      await this.guarded(() => this.book.deleteAddress(userId, addressId, current.version));
      return true;
    } catch (error) {
      if (error instanceof LotError && error.code === "address_not_found") return false;
      throw error;
    }
  }

  /** Bid has one default; in the book it means the person's default for shipping and billing. */
  async setDefault(userId: string, addressId: string): Promise<void> {
    await this.guarded(() => this.book.setDefaultAddress(userId, addressId, "shipping"));
    await this.guarded(() => this.book.setDefaultAddress(userId, addressId, "billing"));
  }

  private async applyDefaults(
    userId: string,
    address: AccountAddress,
    isDefault: boolean | undefined,
    addressType: CreateAddressInput["addressType"],
  ): Promise<AccountAddress> {
    if (!isDefault) return address;
    let result = address;
    if (addressType !== "billing" && !result.isDefaultShipping) {
      result = await this.guarded(() =>
        this.book.setDefaultAddress(userId, address.id, "shipping"),
      );
    }
    if (addressType !== "shipping" && !result.isDefaultBilling) {
      result = await this.guarded(() => this.book.setDefaultAddress(userId, address.id, "billing"));
    }
    return result;
  }

  /**
   * Bid never recorded who an address is for, the book does. The person's own name is the
   * sensible default, with the label as a last resort so the field is never empty.
   */
  private async toFields(
    userId: string,
    input: CreateAddressInput,
    existing?: AccountAddress,
  ): Promise<AccountAddressInput> {
    const country = countryToIso(input.country);
    if (!country) {
      throw new LotError("Choose a country from the list", 400, "invalid_address");
    }
    return {
      label: input.label,
      recipientName:
        existing?.recipientName ?? ((await this.readName(userId))?.trim() || input.label),
      line1: input.line1,
      line2: input.line2?.trim() ? input.line2 : null,
      city: input.city,
      region: input.state?.trim() ? input.state : null,
      postcode: input.postalCode,
      country,
      phone: existing?.phone ?? null,
    };
  }

  private async guarded<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof IdentityIssuerClientError) {
        if (error.code === "address_limit_reached") {
          throw new LotError("You can save up to 20 addresses", 409, "address_limit_reached");
        }
        if (error.code === "invalid_address") {
          throw new LotError("Check the address details", 400, "invalid_address");
        }
        if (error.code === "version_conflict") {
          throw new LotError(
            "This address changed elsewhere; reload and try again",
            409,
            "version_conflict",
          );
        }
        if (error.code === "address_not_found") {
          throw new LotError("Address not found", 404, "address_not_found");
        }
      }
      throw error;
    }
  }
}

function definedOnly(input: UpdateAddressInput): UpdateAddressInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as UpdateAddressInput;
}

function toCreateInput(address: AccountAddress): CreateAddressInput {
  return {
    label: address.label,
    line1: address.line1,
    ...(address.line2 ? { line2: address.line2 } : {}),
    city: address.city,
    ...(address.region ? { state: address.region } : {}),
    postalCode: address.postcode,
    country: address.country,
  };
}

function toRow(userId: string, address: AccountAddress): UserAddressRow {
  return {
    id: address.id,
    userId,
    label: address.label,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.region,
    postalCode: address.postcode,
    country: address.country,
    addressType: "both",
    isDefault: address.isDefaultShipping,
    createdAt: new Date(address.createdAt),
  };
}
