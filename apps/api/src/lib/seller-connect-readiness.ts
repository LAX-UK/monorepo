import {
  type ConnectLegalEntityFields,
  isSellerConnectReady as isSellerConnectReadyImpl,
  shouldSkipConnect,
} from "@auction/connect";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { LegalEntity } from "@auction/types";

export type SellerConnectFields = ConnectLegalEntityFields;

export function isSellerConnectReady(seller: SellerConnectFields): boolean {
  return isSellerConnectReadyImpl(seller);
}

export { shouldSkipConnect };

function isConnectBlockedForSeller(seller: LegalEntity | null | undefined): boolean {
  if (!seller) return true;
  if (shouldSkipConnect(seller)) return false;
  return !isSellerConnectReady(seller);
}

/** Batch connect gate per lot for staff catalogue lists (one seller lookup query). */
export async function buildConnectRequiredByLotId(
  lots: ReadonlyArray<{ id: string; sellerLegalEntityId?: string | null | undefined }>,
  legalEntityRepository: ILegalEntityRepository,
  connectEnforced: boolean,
): Promise<Map<string, boolean>> {
  const record = new Map<string, boolean>();
  if (!connectEnforced) {
    for (const lot of lots) record.set(lot.id, false);
    return record;
  }

  const sellerIds = [
    ...new Set(lots.map((l) => l.sellerLegalEntityId).filter((id): id is string => Boolean(id))),
  ];
  const sellers = sellerIds.length > 0 ? await legalEntityRepository.findByIds(sellerIds) : [];
  const sellerById = new Map(sellers.map((s) => [s.id, s]));

  for (const lot of lots) {
    if (!lot.sellerLegalEntityId) {
      record.set(lot.id, false);
      continue;
    }
    const seller = sellerById.get(lot.sellerLegalEntityId);
    record.set(lot.id, isConnectBlockedForSeller(seller));
  }
  return record;
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
