import type { AccountAddress } from "@auction/identity-contracts";
import type { IAddressRepository, UserAddressRow } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../lib/errors.js";
import { IdentityIssuerClientError } from "./http-identity-issuer.client.js";
import { IdentityAddressBookRepository } from "./identity-address-book.repository.js";

const USER = "user-1";
const BOOK_ID = "33333333-3333-4333-8333-333333333333";
const LEGACY_ID = "44444444-4444-4444-8444-444444444444";

function bookAddress(overrides: Partial<AccountAddress> = {}): AccountAddress {
  return {
    id: BOOK_ID,
    label: "Home",
    recipientName: "Ada Lovelace",
    line1: "1 High Street",
    line2: null,
    city: "London",
    region: null,
    postcode: "SW1A 1AA",
    country: "GB",
    phone: "+447700900123",
    isDefaultShipping: true,
    isDefaultBilling: true,
    version: 4,
    createdAt: "2026-10-23T12:00:00.000Z",
    updatedAt: "2026-10-23T12:00:00.000Z",
    ...overrides,
  };
}

function legacyRow(overrides: Partial<UserAddressRow> = {}): UserAddressRow {
  return {
    id: LEGACY_ID,
    userId: USER,
    label: "Old flat",
    line1: "9 Low Road",
    line2: null,
    city: "Leeds",
    state: null,
    postalCode: "LS1 1AA",
    country: "Ruritania",
    addressType: "both",
    isDefault: true,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function setup(options: { book?: AccountAddress[]; legacy?: UserAddressRow[] } = {}) {
  const book = {
    listAddresses: vi.fn().mockResolvedValue(options.book ?? [bookAddress()]),
    createAddress: vi
      .fn()
      .mockResolvedValue(bookAddress({ isDefaultShipping: false, isDefaultBilling: false })),
    updateAddress: vi.fn().mockResolvedValue(bookAddress({ version: 5 })),
    deleteAddress: vi.fn().mockResolvedValue(undefined),
    setDefaultAddress: vi.fn().mockImplementation(async (_s, _id, kind: string) =>
      bookAddress({
        isDefaultShipping: kind === "shipping",
        isDefaultBilling: kind === "billing",
      }),
    ),
  };
  const legacy: IAddressRepository = {
    listByUser: vi.fn().mockResolvedValue(options.legacy ?? []),
    findByIdForUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
    setDefault: vi.fn(),
  };
  const log = { warn: vi.fn() };
  const repository = new IdentityAddressBookRepository(
    book,
    legacy,
    async () => "Ada Lovelace",
    log,
  );
  return { repository, book, legacy, log };
}

const refusal = (code: string, status = 409) =>
  new IdentityIssuerClientError("http", code, status, code);

describe("IdentityAddressBookRepository reads", () => {
  it("serves the book in Bid's shape: every address ships and bills, the shipping default is the default", async () => {
    const { repository } = setup({ book: [bookAddress({ isDefaultBilling: false })] });
    expect(await repository.listByUser(USER)).toEqual([
      {
        id: BOOK_ID,
        userId: USER,
        label: "Home",
        line1: "1 High Street",
        line2: null,
        city: "London",
        state: null,
        postalCode: "SW1A 1AA",
        country: "GB",
        addressType: "both",
        isDefault: true,
        createdAt: new Date("2026-10-23T12:00:00.000Z"),
      },
    ]);
  });

  it("keeps addresses not yet copied readable, without a second default", async () => {
    const { repository } = setup({ legacy: [legacyRow()] });
    const rows = await repository.listByUser(USER);
    expect(rows.map((row) => [row.id, row.isDefault])).toEqual([
      [BOOK_ID, true],
      [LEGACY_ID, false],
    ]);
  });

  it("does not repeat an address that exists in both places", async () => {
    const { repository } = setup({ legacy: [legacyRow({ id: BOOK_ID })] });
    expect(await repository.listByUser(USER)).toHaveLength(1);
  });

  it("falls back to the legacy list when the book cannot be reached", async () => {
    const { repository, book, log } = setup({ legacy: [legacyRow()] });
    book.listAddresses.mockRejectedValue(new IdentityIssuerClientError("timeout", "slow"));
    expect((await repository.listByUser(USER)).map((row) => row.id)).toEqual([LEGACY_ID]);
    expect(log.warn).toHaveBeenCalled();
  });

  it("resolves an address id from either place for checkout", async () => {
    const { repository } = setup({ legacy: [legacyRow()] });
    expect((await repository.findByIdForUser(USER, LEGACY_ID))?.id).toBe(LEGACY_ID);
    expect((await repository.findByIdForUser(USER, BOOK_ID))?.id).toBe(BOOK_ID);
    expect(
      await repository.findByIdForUser(USER, "55555555-5555-4555-8555-555555555555"),
    ).toBeNull();
  });
});

describe("IdentityAddressBookRepository writes", () => {
  const input = {
    label: "Studio",
    line1: "500 Main Street",
    city: "Austin",
    state: "Texas",
    postalCode: "73301",
    country: "United States",
  };

  it("maps Bid's fields and a country name onto the book, using the person's name as recipient", async () => {
    const { repository, book } = setup();
    await repository.create(USER, input);
    expect(book.createAddress).toHaveBeenCalledWith(USER, {
      label: "Studio",
      recipientName: "Ada Lovelace",
      line1: "500 Main Street",
      line2: null,
      city: "Austin",
      region: "Texas",
      postcode: "73301",
      country: "US",
      phone: null,
    });
  });

  it("refuses a country it cannot read instead of guessing", async () => {
    const { repository, book } = setup();
    await expect(repository.create(USER, { ...input, country: "Ruritania" })).rejects.toMatchObject(
      {
        status: 400,
        code: "invalid_address",
      },
    );
    expect(book.createAddress).not.toHaveBeenCalled();
  });

  it("makes a new default address the default for what its type allows", async () => {
    const both = setup();
    await both.repository.create(USER, { ...input, isDefault: true });
    expect(both.book.setDefaultAddress.mock.calls.map((call) => call[2])).toEqual([
      "shipping",
      "billing",
    ]);

    const shipping = setup();
    await shipping.repository.create(USER, { ...input, isDefault: true, addressType: "shipping" });
    expect(shipping.book.setDefaultAddress.mock.calls.map((call) => call[2])).toEqual(["shipping"]);

    const plain = setup();
    await plain.repository.create(USER, input);
    expect(plain.book.setDefaultAddress).not.toHaveBeenCalled();
  });

  it("reports the address limit and bad details as client errors", async () => {
    const { repository, book } = setup();
    book.createAddress.mockRejectedValueOnce(refusal("address_limit_reached"));
    await expect(repository.create(USER, input)).rejects.toMatchObject({
      status: 409,
      code: "address_limit_reached",
    });
    book.createAddress.mockRejectedValueOnce(refusal("invalid_address", 400));
    await expect(repository.create(USER, input)).rejects.toBeInstanceOf(LotError);
  });

  it("does not hide a failure of the book itself", async () => {
    const { repository, book } = setup();
    book.createAddress.mockRejectedValueOnce(new IdentityIssuerClientError("timeout", "slow"));
    await expect(repository.create(USER, input)).rejects.toBeInstanceOf(IdentityIssuerClientError);
  });

  it("updates with the current version, keeping the fields not sent and the recipient", async () => {
    const { repository, book } = setup();
    const row = await repository.update(USER, BOOK_ID, { city: "Westminster" });
    expect(book.updateAddress).toHaveBeenCalledWith(
      USER,
      BOOK_ID,
      4,
      expect.objectContaining({
        city: "Westminster",
        line1: "1 High Street",
        recipientName: "Ada Lovelace",
        country: "GB",
        phone: "+447700900123",
      }),
    );
    expect(row?.id).toBe(BOOK_ID);
  });

  it("answers not found for an address that is not in the book", async () => {
    const { repository, book } = setup();
    expect(await repository.update(USER, LEGACY_ID, { city: "X" })).toBeNull();
    expect(book.updateAddress).not.toHaveBeenCalled();
  });

  it("deletes with the current version, from the book or from the legacy table", async () => {
    const { repository, book, legacy } = setup();
    expect(await repository.delete(USER, BOOK_ID)).toBe(true);
    expect(book.deleteAddress).toHaveBeenCalledWith(USER, BOOK_ID, 4);
    expect(await repository.delete(USER, LEGACY_ID)).toBe(true);
    expect(legacy.delete).toHaveBeenCalledWith(USER, LEGACY_ID);
  });

  it("treats a delete that loses a race with another delete as not found", async () => {
    const { repository, book } = setup();
    book.deleteAddress.mockRejectedValueOnce(refusal("address_not_found", 404));
    expect(await repository.delete(USER, BOOK_ID)).toBe(false);
  });

  it("makes Bid's single default the default for shipping and billing", async () => {
    const { repository, book } = setup();
    await repository.setDefault(USER, BOOK_ID);
    expect(book.setDefaultAddress.mock.calls.map((call) => call.slice(1))).toEqual([
      [BOOK_ID, "shipping"],
      [BOOK_ID, "billing"],
    ]);
  });
});
