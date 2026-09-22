import { ShopDomainError } from "@auction/shop-domain";

export type ExistingArtworkIdentity = {
  slug: string;
  eligibleForEditionAllocation: boolean;
};

export type RequestedArtworkIdentity = ExistingArtworkIdentity;

export function assertArtworkImportIdentityUnchanged(
  existing: ExistingArtworkIdentity,
  requested: RequestedArtworkIdentity,
): void {
  if (existing.eligibleForEditionAllocation !== requested.eligibleForEditionAllocation) {
    throw new ShopDomainError("Edition eligibility is immutable after artwork creation");
  }
  if (existing.slug !== requested.slug) {
    throw new ShopDomainError("Artwork slug is immutable after artwork creation");
  }
}
