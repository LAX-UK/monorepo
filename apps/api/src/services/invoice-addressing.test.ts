import type { LegalEntity } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { AppLogger } from "../lib/logger.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IPaymentWriteRepository } from "./interfaces/payment-write.js";
import type { IAddressRepository } from "./interfaces/profile.js";
import type { IProfileReader } from "./interfaces/profile.js";
import { InvoiceAddressingService } from "./invoice-addressing.js";

function silentLogger(): AppLogger {
  const fn = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() };
  const self = { ...fn, child: () => self };
  return self as unknown as AppLogger;
}

const orgEntity = (overrides: Partial<LegalEntity> = {}): LegalEntity => ({
  id: "le-org",
  displayName: "Acme Gallery",
  legalName: "Acme Gallery Ltd",
  slug: "acme",
  kind: "organisation",
  subkind: "gallery",
  createdByUserId: "u1",
  status: "approved",
  statusChangedAt: null,
  statusChangedByUserId: null,
  stripeConnectAccountId: null,
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectDisabledReason: null,
  xeroContactId: null,
  vatNumber: null,
  marginSchemeEligible: false,
  isLaxManaged: false,
  platformFeeBps: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const indEntity = (overrides: Partial<LegalEntity> = {}): LegalEntity => ({
  ...orgEntity({
    kind: "individual",
    subkind: "private_collector",
    legalName: null,
    displayName: "Jane",
  }),
  ...overrides,
});

describe("InvoiceAddressingService.resolveForPayment", () => {
  it("organisation with VAT and preferred address", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-org",
        paidByUserId: "u1",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(orgEntity({ vatNumber: "GB123456789" })),
      findPreferredBillToLegalEntityAddress: vi.fn().mockResolvedValue({
        line1: "1 High St",
        line2: "Suite 2",
        city: "London",
        state: null,
        postalCode: "EC1A 1BB",
        country: "GB",
        addressType: "billing",
      }),
    } as unknown as ILegalEntityRepository;
    const profiles = { getProfile: vi.fn() } as unknown as IProfileReader;
    const addresses = { listByUser: vi.fn() } as unknown as IAddressRepository;
    const svc = new InvoiceAddressingService(
      payments,
      legalEntities,
      profiles,
      addresses,
      silentLogger(),
    );
    const { billTo, warnings } = await svc.resolveForPayment("pay1");
    expect(billTo.kind).toBe("organisation");
    expect(billTo.billToName).toBe("Acme Gallery Ltd");
    expect(billTo.vatLine).toBe("VAT: GB123456789");
    expect(billTo.addressIncomplete).toBe(false);
    expect(billTo.addressLines.join("|")).toContain("1 High St");
    expect(warnings).toHaveLength(0);
  });

  it("organisation without VAT", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-org",
        paidByUserId: "u1",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(orgEntity({ vatNumber: null })),
      findPreferredBillToLegalEntityAddress: vi.fn().mockResolvedValue({
        line1: "1 High St",
        line2: null,
        city: "London",
        state: null,
        postalCode: "EC1A 1BB",
        country: "GB",
        addressType: "registered_office",
      }),
    } as unknown as ILegalEntityRepository;
    const svc = new InvoiceAddressingService(
      payments,
      legalEntities,
      {} as IProfileReader,
      { listByUser: vi.fn() } as unknown as IAddressRepository,
      silentLogger(),
    );
    const { billTo } = await svc.resolveForPayment("pay1");
    expect(billTo.vatLine).toBeNull();
  });

  it("organisation with no legal_entity_address — blank + warning (option a)", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-org",
        paidByUserId: "u1",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(orgEntity()),
      findPreferredBillToLegalEntityAddress: vi.fn().mockResolvedValue(null),
    } as unknown as ILegalEntityRepository;
    const warnSpy = vi.fn();
    const log = {
      warn: warnSpy,
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child() {
        return this;
      },
    } as unknown as AppLogger;
    const svc = new InvoiceAddressingService(
      payments,
      legalEntities,
      {} as IProfileReader,
      { listByUser: vi.fn() } as unknown as IAddressRepository,
      log,
    );
    const { billTo, warnings } = await svc.resolveForPayment("pay1");
    expect(billTo.addressLines).toEqual([]);
    expect(billTo.addressIncomplete).toBe(true);
    expect(warnings).toContain("organisation_missing_legal_entity_address");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("individual with default user_address", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-ind",
        paidByUserId: "u-buyer",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(indEntity()),
      findPreferredBillToLegalEntityAddress: vi.fn(),
    } as unknown as ILegalEntityRepository;
    const profiles = {
      getProfile: vi.fn().mockResolvedValue({ name: "Jane Doe" }),
    } as unknown as IProfileReader;
    const addresses = {
      listByUser: vi.fn().mockResolvedValue([
        {
          id: "a1",
          userId: "u-buyer",
          label: "Home",
          line1: "10 Baker St",
          line2: null,
          city: "London",
          state: null,
          postalCode: "NW1",
          country: "GB",
          addressType: "both",
          isDefault: true,
          createdAt: new Date(),
        },
      ]),
    } as unknown as IAddressRepository;
    const svc = new InvoiceAddressingService(
      payments,
      legalEntities,
      profiles,
      addresses,
      silentLogger(),
    );
    const { billTo, warnings } = await svc.resolveForPayment("pay1");
    expect(billTo.kind).toBe("individual");
    expect(billTo.billToName).toBe("Jane Doe");
    expect(billTo.addressIncomplete).toBe(false);
    expect(billTo.addressLines[0]).toBe("10 Baker St");
    expect(warnings).toHaveLength(0);
    expect(legalEntities.findPreferredBillToLegalEntityAddress).not.toHaveBeenCalled();
  });

  it("individual without default user_address — blank + warning (option a)", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-ind",
        paidByUserId: "u-buyer",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(indEntity()),
      findPreferredBillToLegalEntityAddress: vi.fn(),
    } as unknown as ILegalEntityRepository;
    const profiles = {
      getProfile: vi.fn().mockResolvedValue({ name: "Jane" }),
    } as unknown as IProfileReader;
    const addresses = {
      listByUser: vi.fn().mockResolvedValue([]),
    } as unknown as IAddressRepository;
    const log = silentLogger();
    const svc = new InvoiceAddressingService(payments, legalEntities, profiles, addresses, log);
    const { billTo, warnings } = await svc.resolveForPayment("pay1");
    expect(billTo.addressLines).toEqual([]);
    expect(billTo.addressIncomplete).toBe(true);
    expect(warnings).toContain("individual_missing_default_user_address");
  });

  it("individual picks first user address when none marked default", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-ind",
        paidByUserId: "u-buyer",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(indEntity()),
      findPreferredBillToLegalEntityAddress: vi.fn(),
    } as unknown as ILegalEntityRepository;
    const profiles = {
      getProfile: vi.fn().mockResolvedValue({ name: "Pat" }),
    } as unknown as IProfileReader;
    const addresses = {
      listByUser: vi.fn().mockResolvedValue([
        {
          id: "a1",
          userId: "u-buyer",
          label: "A",
          line1: "First line",
          line2: null,
          city: "Leeds",
          state: null,
          postalCode: "LS1",
          country: "GB",
          addressType: "shipping",
          isDefault: false,
          createdAt: new Date(),
        },
      ]),
    } as unknown as IAddressRepository;
    const svc = new InvoiceAddressingService(
      payments,
      legalEntities,
      profiles,
      addresses,
      silentLogger(),
    );
    const { billTo } = await svc.resolveForPayment("pay1");
    expect(billTo.addressLines[0]).toBe("First line");
  });

  it("falls back to display_name when legal_name absent (organisation)", async () => {
    const payments = {
      findById: vi.fn().mockResolvedValue({
        id: "pay1",
        buyerLegalEntityId: "le-org",
        paidByUserId: "u1",
      }),
    } as unknown as IPaymentWriteRepository;
    const legalEntities = {
      findById: vi.fn().mockResolvedValue(orgEntity({ legalName: null })),
      findPreferredBillToLegalEntityAddress: vi.fn().mockResolvedValue({
        line1: "1 Rd",
        line2: null,
        city: "Manchester",
        state: null,
        postalCode: "M1",
        country: "GB",
        addressType: "both",
      }),
    } as unknown as ILegalEntityRepository;
    const svc = new InvoiceAddressingService(
      payments,
      legalEntities,
      {} as IProfileReader,
      { listByUser: vi.fn() } as unknown as IAddressRepository,
      silentLogger(),
    );
    const { billTo } = await svc.resolveForPayment("pay1");
    expect(billTo.billToName).toBe("Acme Gallery");
  });
});
