import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";

export type SellerConnectFields = {
  status: string;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue?: string[] | null;
};

export function isSellerConnectReady(seller: SellerConnectFields): boolean {
  return (
    seller.status === "approved" &&
    seller.stripeConnectPayoutsEnabled &&
    (seller.stripeConnectRequirementsCurrentlyDue ?? []).length === 0
  );
}

export async function findLotsMissingSellerConnect(
  lots: ReadonlyArray<{
    id: string;
    title: string;
    sellerLegalEntityId?: string | null | undefined;
  }>,
  legalEntityRepository: ILegalEntityRepository,
): Promise<Array<{ id: string; title: string }>> {
  const blocked: Array<{ id: string; title: string }> = [];
  const sellerCache = new Map<string, Awaited<ReturnType<ILegalEntityRepository["findById"]>>>();
  for (const lot of lots) {
    // Lots without sellerLegalEntityId skip Connect (platform-catalog / legacy inventory).
    if (!lot.sellerLegalEntityId) continue;
    let seller = sellerCache.get(lot.sellerLegalEntityId);
    if (seller === undefined) {
      seller = await legalEntityRepository.findById(lot.sellerLegalEntityId);
      sellerCache.set(lot.sellerLegalEntityId, seller);
    }
    if (!seller || !isSellerConnectReady(seller)) {
      blocked.push({ id: lot.id, title: lot.title });
    }
  }
  return blocked;
}
