import type { IInvoiceDetailsRepository, InvoiceDetails } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { InvoiceDetailsService } from "./invoice-details.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const ADDRESS = {
  line1: "1 Cork Street",
  line2: null,
  city: "London",
  region: null,
  postalCode: "W1S 3LL",
  country: "GB",
};

function setup(stored: InvoiceDetails | null = null) {
  let current = stored;
  const details: IInvoiceDetailsRepository = {
    find: vi.fn(async () => current),
    save: vi.fn(async (_id: string, input: Omit<InvoiceDetails, "updatedAt">) => {
      const saved = { ...input, updatedAt: new Date("2026-10-30T10:00:00Z") };
      current = saved;
      return saved;
    }),
  };
  const publish = vi.fn(async () => undefined);
  const service = new InvoiceDetailsService({
    details,
    events: { publish, withTx: () => ({ publish, withTx: vi.fn() }) } as never,
  });
  return { service, details, publish };
}

const actor = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
  userId: "me",
  legalEntityId: ENTITY,
  role,
  isImpersonation,
});

const input = { billingEmail: "accounts@northbank.example", address: ADDRESS, poReference: "PO-1" };

describe("InvoiceDetailsService", () => {
  it.each(["owner", "admin", "finance"] as const)(
    "%s reads and changes the details",
    async (role) => {
      const { service, publish } = setup();
      expect((await service.view(actor(role)))._unsafeUnwrap()).toMatchObject({
        billingEmail: null,
        address: null,
        canEdit: true,
      });
      const saved = (await service.update(actor(role), input))._unsafeUnwrap();
      expect(saved).toMatchObject({ poReference: "PO-1", canEdit: true });
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "legal_entity.invoice_details_changed",
          payload: { changed_fields: ["billing_email", "address", "po_reference"] },
          actorUserId: "me",
          actingLegalEntityId: ENTITY,
        }),
      );
    },
  );

  it.each(["consignor", "buyer_agent", "viewer"] as const)(
    "%s can neither read nor change them",
    async (role) => {
      const { service, details } = setup();
      expect((await service.view(actor(role)))._unsafeUnwrapErr().status).toBe(403);
      expect((await service.update(actor(role), input))._unsafeUnwrapErr().status).toBe(403);
      expect(details.save).not.toHaveBeenCalled();
    },
  );

  it("lets support staff read but not change", async () => {
    const { service } = setup();
    expect((await service.view(actor("admin", true)))._unsafeUnwrap().canEdit).toBe(false);
    expect((await service.update(actor("admin", true), input)).isErr()).toBe(true);
  });

  it("records only the fields that changed, and nothing when none did", async () => {
    const { service, publish } = setup({ ...input, updatedAt: new Date() });
    await service.update(actor("finance"), { ...input, poReference: "PO-2" });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { changed_fields: ["po_reference"] } }),
    );
    publish.mockClear();
    await service.update(actor("finance"), { ...input, poReference: "PO-2" });
    expect(publish).not.toHaveBeenCalled();
  });
});
