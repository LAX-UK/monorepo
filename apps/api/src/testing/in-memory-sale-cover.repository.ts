import type {
  HomePinnedSale,
  ISaleCoverRepository,
  SaleCoverState,
  SaleHomePatch,
  SaleHomeState,
} from "@auction/persistence/interfaces";
import type { SaleCoverSlot, SaleCoverSlotName, SaleStatus } from "@auction/types";

type StoredSale = SaleCoverState & SaleHomeState;
type StoredLot = { saleId: string | null; images: string[] };

/** A sale cover repository held in memory, for tests of the rules around it. */
export class InMemorySaleCoverRepository implements ISaleCoverRepository {
  readonly sales = new Map<string, StoredSale>();
  readonly lots = new Map<string, StoredLot>();

  addSale(id: string, overrides: Partial<StoredSale> = {}): void {
    this.sales.set(id, {
      id,
      status: "active",
      coverImages: [],
      coverSlots: {},
      subtitle: null,
      featuredLotIds: [],
      consignmentDeadline: null,
      homePinOrder: null,
      ...overrides,
    });
  }

  addLot(id: string, lot: StoredLot): void {
    this.lots.set(id, lot);
  }

  async getState(saleId: string): Promise<SaleCoverState | null> {
    const found = this.sales.get(saleId);
    return found
      ? {
          id: found.id,
          status: found.status,
          coverImages: found.coverImages,
          coverSlots: found.coverSlots,
        }
      : null;
  }

  async setSlot(saleId: string, name: SaleCoverSlotName, slot: SaleCoverSlot): Promise<void> {
    const found = this.sales.get(saleId);
    if (found) found.coverSlots = { ...found.coverSlots, [name]: slot };
  }

  async clearSlot(saleId: string, name: SaleCoverSlotName): Promise<void> {
    const found = this.sales.get(saleId);
    if (!found) return;
    const { [name]: _removed, ...rest } = found.coverSlots;
    found.coverSlots = rest;
  }

  async getHome(saleId: string): Promise<SaleHomeState | null> {
    const found = this.sales.get(saleId);
    return found
      ? {
          subtitle: found.subtitle,
          featuredLotIds: found.featuredLotIds,
          consignmentDeadline: found.consignmentDeadline,
          homePinOrder: found.homePinOrder,
        }
      : null;
  }

  async updateHome(saleId: string, patch: SaleHomePatch): Promise<void> {
    const found = this.sales.get(saleId);
    if (!found) return;
    if (patch.subtitle !== undefined) found.subtitle = patch.subtitle;
    if (patch.featuredLotIds !== undefined) found.featuredLotIds = patch.featuredLotIds;
    if (patch.consignmentDeadline !== undefined) {
      found.consignmentDeadline = patch.consignmentDeadline;
    }
  }

  async listLotIds(saleId: string): Promise<Set<string>> {
    return new Set(
      [...this.lots].filter(([, lot]) => lot.saleId === saleId).map(([lotId]) => lotId),
    );
  }

  async getLotImages(lotId: string): Promise<StoredLot | null> {
    return this.lots.get(lotId) ?? null;
  }

  async getSaleStatuses(saleIds: readonly string[]): Promise<Map<string, SaleStatus>> {
    return new Map(
      saleIds.flatMap((id) => {
        const found = this.sales.get(id);
        return found ? [[id, found.status] as const] : [];
      }),
    );
  }

  async listHomePins(): Promise<HomePinnedSale[]> {
    return [...this.sales.values()]
      .flatMap((found) =>
        found.homePinOrder === null
          ? []
          : [{ saleId: found.id, title: `Sale ${found.id}`, position: found.homePinOrder }],
      )
      .sort((a, b) => a.position - b.position);
  }

  async replaceHomePins(saleIds: readonly string[]): Promise<void> {
    for (const found of this.sales.values()) found.homePinOrder = null;
    for (const [index, id] of saleIds.entries()) {
      const found = this.sales.get(id);
      if (found) found.homePinOrder = index + 1;
    }
  }
}
