import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleIdentityAddressRepository } from "../infrastructure/drizzle-identity-address-repository.js";
import { IdentityAddressService } from "../services/identity-address.service.js";

export function createIdentityAddressService(db: IdentityDatabase): IdentityAddressService {
  return new IdentityAddressService(new DrizzleIdentityAddressRepository(db));
}
