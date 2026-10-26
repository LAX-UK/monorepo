import type { SaleStatus } from "@auction/types";
import type {
  AtgGateway,
  AtgIncrementSet,
  AtgRemoteAuction,
  AtgRemoteLot,
  AtgSaleResult,
} from "../atg-gateway.js";
import type { AtgImageFacts, AtgImageInspector } from "../atg-image-inspector.js";
import type { AtgAuctionLinkPatch, AtgLotLinkPatch, AtgSyncStore } from "../atg-sync-store.js";
import type {
  AtgAuctionLink,
  AtgLotLink,
  AtgSaleOwnershipSnapshot,
  AtgSaleSnapshot,
} from "../atg-types.js";
import type {
  GapAddUrlImageToLotRequest,
  GapCreateAuctionRequest,
  GapCreateLotRequest,
  GapUpdateAuctionRequest,
  GapUpdateLotRequest,
} from "../gap-types.js";

type GatewayCall = { op: keyof AtgGateway; arg: unknown };

/** Every image is a small JPG unless `facts` says otherwise for its URL. */
export class FakeAtgImageInspector implements AtgImageInspector {
  readonly facts = new Map<string, AtgImageFacts>();
  readonly inspected: string[] = [];

  async inspect(url: string): Promise<AtgImageFacts> {
    this.inspected.push(url);
    return this.facts.get(url) ?? { contentType: "image/jpeg", bytes: 200_000, error: null };
  }
}

/** Records calls; `failNext` makes a later call to an operation throw. */
export class FakeAtgGateway implements AtgGateway {
  readonly calls: GatewayCall[] = [];
  remoteLots: AtgRemoteLot[] = [];
  saleResults: AtgSaleResult[] = [];
  /** `getAuction` answers from here by auction id; unknown ids are null. */
  remoteAuctions = new Map<string, AtgRemoteAuction>();
  /** What `findAuctionsByClientId` returns. */
  clientAuctions: AtgRemoteAuction[] = [];
  incrementSets: AtgIncrementSet[] = [];
  supportedCategories: string[] = [];
  private seq = 0;
  private readonly failures = new Map<keyof AtgGateway, Array<Error | null>>();

  /** Fails the call to `op` that comes after `afterCalls` successful ones. */
  failNext(op: keyof AtgGateway, err: Error, afterCalls = 0): void {
    const passes: null[] = Array.from({ length: afterCalls }, () => null);
    this.failures.set(op, [...(this.failures.get(op) ?? []), ...passes, err]);
  }

  ops(): Array<keyof AtgGateway> {
    return this.calls.map((c) => c.op);
  }

  private record(op: keyof AtgGateway, arg: unknown): void {
    this.calls.push({ op, arg });
    const queued = this.failures.get(op);
    const err = queued?.shift();
    if (err) throw err;
  }

  async createAuction(request: GapCreateAuctionRequest) {
    this.record("createAuction", request);
    return { auctionId: "atg-auction-1" };
  }
  async updateAuction(request: GapUpdateAuctionRequest) {
    this.record("updateAuction", request);
  }
  async publishAuction(auctionId: string) {
    this.record("publishAuction", auctionId);
  }
  async closeAuction(auctionId: string) {
    this.record("closeAuction", auctionId);
  }
  async createLot(request: GapCreateLotRequest) {
    this.record("createLot", request);
    this.seq += 1;
    return { lotId: `atg-lot-${this.seq}` };
  }
  async updateLot(request: GapUpdateLotRequest) {
    this.record("updateLot", request);
  }
  async deleteLot(atgLotId: string) {
    this.record("deleteLot", atgLotId);
  }
  async addLotImageUrl(request: GapAddUrlImageToLotRequest) {
    this.record("addLotImageUrl", request);
  }
  async getLots(auctionId: string) {
    this.record("getLots", auctionId);
    return this.remoteLots;
  }
  async getSaleResults(auctionId: string) {
    this.record("getSaleResults", auctionId);
    return this.saleResults;
  }
  async getAuction(auctionId: string) {
    this.record("getAuction", auctionId);
    return this.remoteAuctions.get(auctionId) ?? null;
  }
  async findAuctionsByClientId(clientId: string, fromDate: Date) {
    this.record("findAuctionsByClientId", { clientId, fromDate });
    return this.clientAuctions;
  }
  async getIncrementSets(clientId: string) {
    this.record("getIncrementSets", clientId);
    return this.incrementSets;
  }
  async getSupportedCategories(platformCode: string) {
    this.record("getSupportedCategories", platformCode);
    return this.supportedCategories;
  }
}

type StoredAuctionLink = AtgAuctionLink & Omit<AtgAuctionLinkPatch, keyof AtgAuctionLink>;
type StoredLotLink = AtgLotLink & AtgLotLinkPatch & Partial<Omit<AtgRemoteLot, "atgLotId">>;

export class InMemoryAtgSyncStore implements AtgSyncStore {
  readonly sales = new Map<string, AtgSaleSnapshot>();
  readonly auctionLinks = new Map<string, StoredAuctionLink>();
  readonly lotLinks = new Map<string, StoredLotLink>();
  changedSales = new Set<string>();

  async loadSale(saleId: string) {
    return this.sales.get(saleId) ?? null;
  }
  async loadOwnershipState(saleId: string): Promise<AtgSaleOwnershipSnapshot | null> {
    const sale = this.sales.get(saleId);
    if (!sale) return null;
    const link = this.auctionLinks.get(saleId);
    const sold = [...this.lotLinks.values()].filter(
      (l) => l.saleId === saleId && l.sold === true,
    ).length;
    return {
      saleStatus: (sale.saleStatus ?? "draft") as SaleStatus,
      atgRemoteStatus: link?.remoteStatus ?? null,
      atgLinked: Boolean(link?.atgAuctionId),
      atgSoldLotCount: sold,
    };
  }
  async getAuctionLink(saleId: string) {
    return this.auctionLinks.get(saleId) ?? null;
  }
  async saveAuctionLink(saleId: string, patch: AtgAuctionLinkPatch) {
    const current: StoredAuctionLink = this.auctionLinks.get(saleId) ?? {
      saleId,
      atgAuctionId: null,
      remoteStatus: "pending",
      payloadHash: null,
      lastSyncedAt: null,
      approvedAt: null,
      closedAt: null,
      lastError: null,
    };
    this.auctionLinks.set(saleId, { ...current, ...patch });
  }
  async listLotLinks(saleId: string) {
    return [...this.lotLinks.values()].filter((l) => l.saleId === saleId);
  }
  async getLotLink(lotId: string) {
    return this.lotLinks.get(lotId) ?? null;
  }
  async findLotLinks(lotIds: string[]) {
    return [...this.lotLinks.values()].filter((l) => lotIds.includes(l.lotId));
  }
  async insertLotLink(
    link: Pick<AtgLotLink, "lotId" | "saleId" | "atgLotId"> & {
      payloadHash: string;
      lockedFieldsHash: string;
    },
  ) {
    this.lotLinks.set(link.lotId, { ...link, imageNames: [], numberOfBids: 0 });
  }
  async updateLotLink(lotId: string, patch: AtgLotLinkPatch) {
    const current = this.lotLinks.get(lotId);
    if (current) this.lotLinks.set(lotId, { ...current, ...patch });
  }
  async deleteLotLink(lotId: string) {
    this.lotLinks.delete(lotId);
  }
  async applyRemoteLots(saleId: string, lots: AtgRemoteLot[], _polledAt?: Date) {
    for (const link of this.lotLinks.values()) {
      if (link.saleId !== saleId) continue;
      const remote = lots.find((l) => l.atgLotId === link.atgLotId);
      if (remote) Object.assign(link, remote, { numberOfBids: remote.numberOfBids ?? 0 });
    }
  }
  async listActiveAuctionLinks(closedSince: Date) {
    return [...this.auctionLinks.values()].filter(
      (l) =>
        l.atgAuctionId &&
        (["created", "approved", "published"].includes(l.remoteStatus) ||
          (l.remoteStatus === "closed" && l.closedAt != null && l.closedAt >= closedSince)),
    );
  }
  async hasCatalogueChangesSince(saleId: string, _since: Date) {
    return this.changedSales.has(saleId);
  }
}
