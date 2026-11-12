import type {
  IBidPublishSettings,
  IUnlinkedOriginalsReader,
  UnlinkedOriginal,
} from "@auction/persistence/interfaces";

/** Rows shown per product; the counts always cover every one. */
export const UNLINKED_ORIGINALS_LISTED_PER_PRODUCT = 500;

export type UnlinkedOriginalsView = {
  /** Whether LAX Bid refuses to publish a lot that is not linked to its Zoho record. */
  blockPublishing: boolean;
  counts: { bid: number; laxArt: number };
  items: UnlinkedOriginal[];
};

/**
 * What staff need before they turn the switches on: every original that is live without a Zoho
 * record, on lax.art and in LAX Bid, and the Bid-side switch itself. It reads and records the
 * switch only; linking an artwork happens where the artwork is edited.
 */
export class UnlinkedOriginalsService {
  constructor(
    private readonly deps: {
      originals: IUnlinkedOriginalsReader;
      settings: IBidPublishSettings;
    },
  ) {}

  async view(): Promise<UnlinkedOriginalsView> {
    const [report, blockPublishing] = await Promise.all([
      this.deps.originals.listLiveUnlinkedOriginals(UNLINKED_ORIGINALS_LISTED_PER_PRODUCT),
      this.deps.settings.blockUnlinkedPublish(),
    ]);
    return { blockPublishing, counts: report.counts, items: report.items };
  }

  async setBlockPublishing(
    enabled: boolean,
    actorUserId: string,
  ): Promise<{ blockPublishing: boolean }> {
    await this.deps.settings.setBlockUnlinkedPublish(enabled, actorUserId);
    return { blockPublishing: enabled };
  }
}
