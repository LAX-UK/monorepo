import type {
  IOrganisationAddressRepository,
  OrganisationAddress,
} from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { OrganisationAddressService } from "./organisation-address.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const FIELDS = {
  line1: "1 Cork Street",
  line2: null,
  city: "London",
  region: null,
  postalCode: "W1S 3LL",
  country: "GB",
};
const REGISTERED: OrganisationAddress = { id: "reg-1", kind: "registered", ...FIELDS };

function setup() {
  const addresses: IOrganisationAddressRepository = {
    list: vi.fn(async () => [REGISTERED]),
    addDelivery: vi.fn(async (_id, address) => ({ id: "del-1", kind: "delivery", ...address })),
  };
  return { service: new OrganisationAddressService({ addresses }), addresses };
}

const actor = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
  userId: "me",
  legalEntityId: ENTITY,
  role,
  isImpersonation,
});

describe("OrganisationAddressService", () => {
  it.each(["owner", "admin", "finance", "buyer_agent"] as const)(
    "%s reads the addresses and adds one",
    async (role) => {
      const { service, addresses } = setup();
      expect((await service.list(actor(role)))._unsafeUnwrap()).toEqual({
        addresses: [REGISTERED],
        canAdd: true,
      });
      expect(addresses.list).toHaveBeenCalledWith(ENTITY);
      const added = (await service.add(actor(role), FIELDS))._unsafeUnwrap();
      expect(added).toMatchObject({ kind: "delivery", line1: "1 Cork Street" });
      expect(addresses.addDelivery).toHaveBeenCalledWith(ENTITY, FIELDS);
    },
  );

  it.each(["consignor", "viewer"] as const)("%s can neither read nor add", async (role) => {
    const { service, addresses } = setup();
    expect((await service.list(actor(role)))._unsafeUnwrapErr().status).toBe(403);
    expect((await service.add(actor(role), FIELDS))._unsafeUnwrapErr().status).toBe(403);
    expect(addresses.list).not.toHaveBeenCalled();
    expect(addresses.addDelivery).not.toHaveBeenCalled();
  });

  it("lets support staff read but not add", async () => {
    const { service, addresses } = setup();
    expect((await service.list(actor("admin", true)))._unsafeUnwrap().canAdd).toBe(false);
    expect((await service.add(actor("admin", true), FIELDS)).isErr()).toBe(true);
    expect(addresses.addDelivery).not.toHaveBeenCalled();
  });
});
