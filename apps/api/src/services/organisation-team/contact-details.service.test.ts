import type { ContactDetails, IContactDetailsRepository } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { ContactDetailsService } from "./contact-details.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

function setup(stored: ContactDetails | null = null) {
  let current = stored;
  const details: IContactDetailsRepository = {
    find: vi.fn(async () => current),
    save: vi.fn(async (_id: string, input: Omit<ContactDetails, "updatedAt">) => {
      const saved = { ...input, updatedAt: new Date("2026-11-01T10:00:00Z") };
      current = saved;
      return saved;
    }),
  };
  const publish = vi.fn(async () => undefined);
  const service = new ContactDetailsService({
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

const input = {
  email: "hello@northbank.gallery",
  phone: "+44 20 7946 0321",
  website: "https://northbank.gallery",
};

describe("ContactDetailsService", () => {
  it.each(["owner", "admin"] as const)("%s reads and changes the details", async (role) => {
    const { service, publish } = setup();
    expect((await service.view(actor(role)))._unsafeUnwrap()).toEqual({
      email: null,
      phone: null,
      website: null,
      updatedAt: null,
      canEdit: true,
    });
    const saved = (await service.update(actor(role), input))._unsafeUnwrap();
    expect(saved).toMatchObject({ ...input, canEdit: true });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.contact_details_changed",
        payload: { changed_fields: ["email", "phone", "website"] },
        actorUserId: "me",
        actingLegalEntityId: ENTITY,
      }),
    );
  });

  it.each(["finance", "consignor", "buyer_agent", "viewer"] as const)(
    "%s reads them but cannot change them",
    async (role) => {
      const { service, details } = setup({ ...input, updatedAt: new Date() });
      expect((await service.view(actor(role)))._unsafeUnwrap()).toMatchObject({
        email: input.email,
        canEdit: false,
      });
      expect((await service.update(actor(role), input))._unsafeUnwrapErr()).toMatchObject({
        code: "forbidden",
        status: 403,
      });
      expect(details.save).not.toHaveBeenCalled();
    },
  );

  it("lets support staff read but not change", async () => {
    const { service } = setup();
    expect((await service.view(actor("owner", true)))._unsafeUnwrap().canEdit).toBe(false);
    expect((await service.update(actor("owner", true), input)).isErr()).toBe(true);
  });

  it("records only the fields that changed, never their values, and nothing when none did", async () => {
    const { service, publish } = setup({ ...input, updatedAt: new Date() });
    await service.update(actor("admin"), { ...input, phone: null });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { changed_fields: ["phone"] } }),
    );
    publish.mockClear();
    await service.update(actor("admin"), { ...input, phone: null });
    expect(publish).not.toHaveBeenCalled();
  });
});
