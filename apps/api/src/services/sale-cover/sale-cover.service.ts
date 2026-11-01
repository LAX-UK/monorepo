import {
  type CoverSlotIssue,
  coverAnalysisHash,
  effectiveCoverSide,
  featuredLotsRefusal,
  homePinsRefusal,
  resolveCoverSlotSources,
  validateCoverSlot,
} from "@auction/domain";
import type {
  ICoverAnalysisReader,
  ISaleCoverRepository,
  SaleHomeState,
} from "@auction/persistence/interfaces";
import type {
  CoverAnalysis,
  CoverAnalysisStatus,
  SaleCoverFromLot,
  SaleCoverSlot,
  SaleCoverSlotName,
} from "@auction/types";
import { SALE_COVER_SLOT_NAMES } from "@auction/types";
import type {
  ReplaceHomePinsBody,
  SetSaleCoverSlotBody,
  UpdateSaleHomeBody,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";

export type SaleCoverError = {
  status: 404 | 409 | 422;
  message: string;
  code:
    | "sale_not_found"
    | "lot_not_found"
    | "lot_not_in_sale"
    | "image_not_found"
    | "image_not_stored"
    | "image_processing"
    | "slot_invalid"
    | "featured_lots_invalid"
    | "pins_invalid";
  issues?: CoverSlotIssue[];
};

/** One slot as staff see it: the stored values, what is wrong with them, and what was measured. */
export type AdminCoverSlotView = {
  source: "slot" | "legacy";
  /** Present for a stored slot. */
  slot?: SaleCoverSlot;
  /** The old array's picture, for a slot staff have not set yet. */
  legacyKey?: string;
  side?: "left" | "right";
  issues: CoverSlotIssue[];
  analysis: { status: "pending" | CoverAnalysisStatus; value: CoverAnalysis | null };
};

export type AdminCoverView = {
  saleId: string;
  slots: Partial<Record<SaleCoverSlotName, AdminCoverSlotView>>;
  home: SaleHomeState;
};

type Dependencies = {
  covers: ISaleCoverRepository;
  /** Pictures' stored sizes; a cover must be a processed picture in LAX storage. */
  media: Pick<IMediaAssetEnricher, "lookupByKeys">;
  analyses: ICoverAnalysisReader;
};

/**
 * Staff choices for the home cover: the named cover slots (with the size floors and the
 * keep-in-frame rule), the featured lots, the home pins and the subtitle. Staff authority is
 * checked at the route; this service holds the rules.
 */
export class SaleCoverService {
  constructor(private readonly deps: Dependencies) {}

  async getView(saleId: string): Promise<Result<AdminCoverView, SaleCoverError>> {
    const state = await this.deps.covers.getState(saleId);
    const home = await this.deps.covers.getHome(saleId);
    if (!state || !home) return err(notFound());

    const sources = resolveCoverSlotSources(state.coverSlots, state.coverImages);
    const hashes = SALE_COVER_SLOT_NAMES.flatMap((name) => {
      const hash = state.coverSlots[name]?.analysisHash;
      return hash ? [hash] : [];
    });
    const records = await this.deps.analyses.lookupByHashes(hashes);
    const phoneSlotPresent = sources.phone !== undefined;

    const slots: AdminCoverView["slots"] = {};
    for (const name of SALE_COVER_SLOT_NAMES) {
      const source = sources[name];
      if (!source) continue;
      if (source.kind === "legacy") {
        slots[name] = {
          source: "legacy",
          legacyKey: source.key,
          issues: [],
          analysis: { status: "pending", value: null },
        };
        continue;
      }
      const record = records.get(source.slot.analysisHash);
      slots[name] = {
        source: "slot",
        slot: source.slot,
        side: effectiveCoverSide(source.slot),
        issues: validateCoverSlot(name, source.slot, { phoneSlotPresent }),
        analysis: {
          status: record ? record.status : "pending",
          value: record?.status === "ready" ? record.analysis : null,
        },
      };
    }
    return ok({ saleId, slots, home });
  }

  /** Sets one slot. A picture below the slot's floor, or a crop that cuts the keep area, is refused. */
  async setSlot(
    saleId: string,
    name: SaleCoverSlotName,
    body: SetSaleCoverSlotBody,
  ): Promise<Result<SaleCoverSlot, SaleCoverError>> {
    const state = await this.deps.covers.getState(saleId);
    if (!state) return err(notFound());

    const pictured = await this.resolvePicture(saleId, body.source);
    if (pictured.isErr()) return err(pictured.error);
    const { key, fromLot, width, height } = pictured.value;

    const draft: Omit<SaleCoverSlot, "analysisHash"> = {
      ...(fromLot ? { fromLot } : { key }),
      width,
      height,
      focal: body.focal,
      ...(body.keep ? { keep: body.keep } : {}),
      zoom: body.zoom,
      alt: body.alt,
      ...(body.toneOverride ? { toneOverride: body.toneOverride } : {}),
      ...(body.sideOverride ? { sideOverride: body.sideOverride } : {}),
    };
    const slot: SaleCoverSlot = { ...draft, analysisHash: coverAnalysisHash(name, draft) };

    const phoneSlotPresent =
      name === "phone" || resolveCoverSlotSources(state.coverSlots, state.coverImages).phone;
    const issues = validateCoverSlot(name, slot, { phoneSlotPresent: Boolean(phoneSlotPresent) });
    if (issues.length > 0) {
      return err({
        status: 422,
        code: "slot_invalid",
        message: describeIssues(name, issues),
        issues,
      });
    }

    await this.deps.covers.setSlot(saleId, name, slot);
    return ok(slot);
  }

  async clearSlot(saleId: string, name: SaleCoverSlotName): Promise<Result<void, SaleCoverError>> {
    const state = await this.deps.covers.getState(saleId);
    if (!state) return err(notFound());
    await this.deps.covers.clearSlot(saleId, name);
    return ok(undefined);
  }

  async updateHome(
    saleId: string,
    body: UpdateSaleHomeBody,
  ): Promise<Result<SaleHomeState, SaleCoverError>> {
    const state = await this.deps.covers.getState(saleId);
    if (!state) return err(notFound());

    if (body.featuredLotIds !== undefined) {
      const lotIds = await this.deps.covers.listLotIds(saleId);
      const refusal = featuredLotsRefusal(body.featuredLotIds, lotIds);
      if (refusal) {
        return err({
          status: 422,
          code: "featured_lots_invalid",
          message: featuredMessage(refusal.code, refusal.code === "too_many" ? refusal.max : 0),
        });
      }
    }

    await this.deps.covers.updateHome(saleId, {
      ...(body.subtitle !== undefined ? { subtitle: body.subtitle || null } : {}),
      ...(body.featuredLotIds !== undefined ? { featuredLotIds: body.featuredLotIds } : {}),
      ...(body.consignmentDeadline !== undefined
        ? { consignmentDeadline: body.consignmentDeadline }
        : {}),
    });
    const home = await this.deps.covers.getHome(saleId);
    return home ? ok(home) : err(notFound());
  }

  /** The sales that lead the home page, first place first. An empty list unpins everything. */
  async replaceHomePins(body: ReplaceHomePinsBody): Promise<Result<string[], SaleCoverError>> {
    const statuses = await this.deps.covers.getSaleStatuses(body.saleIds);
    const refusal = homePinsRefusal(body.saleIds, (saleId) => statuses.get(saleId));
    if (refusal) {
      return err({
        status: 422,
        code: "pins_invalid",
        message: pinsMessage(refusal.code, refusal.code === "too_many" ? refusal.max : 0),
      });
    }
    await this.deps.covers.replaceHomePins(body.saleIds);
    return ok([...body.saleIds]);
  }

  /** Finds the stored picture behind a source and its pixel size, or says why it cannot be used. */
  private async resolvePicture(
    saleId: string,
    source: SetSaleCoverSlotBody["source"],
  ): Promise<
    Result<
      { key: string; fromLot?: SaleCoverFromLot; width: number; height: number },
      SaleCoverError
    >
  > {
    if (source.kind === "upload") {
      const size = await this.storedSize(source.key);
      if (size.isErr()) return err(size.error);
      return ok({ key: source.key, ...size.value });
    }

    const lot = await this.deps.covers.getLotImages(source.lotId);
    if (!lot)
      return err({ status: 404, code: "lot_not_found", message: "That lot was not found." });
    if (lot.saleId !== saleId) {
      return err({
        status: 422,
        code: "lot_not_in_sale",
        message: "Choose a lot from this sale.",
      });
    }
    const imageKey = lot.images[source.imageIndex];
    if (!imageKey) {
      return err({
        status: 404,
        code: "image_not_found",
        message: "That lot has no picture in that position.",
      });
    }
    const size = await this.storedSize(imageKey);
    if (size.isErr()) return err(size.error);
    const crop = source.crop;
    return ok({
      key: imageKey,
      fromLot: { lotId: source.lotId, imageKey, ...(crop ? { crop } : {}) },
      width: crop ? Math.round(size.value.width * crop.width) : size.value.width,
      height: crop ? Math.round(size.value.height * crop.height) : size.value.height,
    });
  }

  private async storedSize(
    key: string,
  ): Promise<Result<{ width: number; height: number }, SaleCoverError>> {
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return err({
        status: 422,
        code: "image_not_stored",
        message: "Cover pictures must be uploaded to LAX.",
      });
    }
    const found = await this.deps.media.lookupByKeys([key]);
    const record = found.values().next().value;
    if (!record) {
      return err({
        status: 409,
        code: "image_processing",
        message: "That picture is still being processed. Try again in a moment.",
      });
    }
    return ok({ width: record.width, height: record.height });
  }
}

function notFound(): SaleCoverError {
  return { status: 404, code: "sale_not_found", message: "That sale was not found." };
}

const BOX_LABEL = { desktop: "desktop", wide: "wide screen", phone: "phone" } as const;

function describeIssues(name: SaleCoverSlotName, issues: CoverSlotIssue[]): string {
  return issues
    .map((issue) => {
      if (issue.code === "below_floor") {
        const need = issue.need.height
          ? `${issue.need.width} × ${issue.need.height}`
          : `${issue.need.width} px wide`;
        return `The ${name} picture needs to be at least ${need} after the zoom; this one is ${issue.have.width} × ${issue.have.height}.`;
      }
      return `The ${BOX_LABEL[issue.box]} crop cuts the area to keep in frame. Move the focal point, zoom out or use the other text side.`;
    })
    .join(" ");
}

function featuredMessage(code: "too_many" | "duplicate" | "not_in_sale", max: number): string {
  if (code === "too_many") return `Feature at most ${max} lots.`;
  if (code === "duplicate") return "A lot can be featured only once.";
  return "Featured lots must belong to this sale.";
}

function pinsMessage(code: "too_many" | "duplicate" | "not_pinnable", max: number): string {
  if (code === "too_many") return `Pin at most ${max} sales to the home page.`;
  if (code === "duplicate") return "A sale can be pinned only once.";
  return "Only a published sale can be pinned to the home page.";
}
