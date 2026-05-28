import {
  type ConnectLegalEntityFields,
  isSellerConnectReady as isSellerConnectReadyImpl,
  shouldSkipConnect,
} from "@auction/connect";
import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";

export type SellerConnectFields = ConnectLegalEntityFields;

export function isSellerConnectReady(seller: SellerConnectFields): boolean {
  return isSellerConnectReadyImpl(seller);
}

export { shouldSkipConnect };

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
    if (!lot.sellerLegalEntityId) continue;
    let seller = sellerCache.get(lot.sellerLegalEntityId);
    if (seller === undefined) {
      seller = await legalEntityRepository.findById(lot.sellerLegalEntityId);
      sellerCache.set(lot.sellerLegalEntityId, seller);
    }
    if (!seller) {
      blocked.push({ id: lot.id, title: lot.title });
      continue;
    }
    if (shouldSkipConnect(seller)) continue;
    if (!isSellerConnectReady(seller)) {
      blocked.push({ id: lot.id, title: lot.title });
    }
  }
  return blocked;
}
