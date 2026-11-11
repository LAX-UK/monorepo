import {
  type ArtworkRegisterEntry,
  WHERE_IT_IS_CHIPS,
  canAcceptZohoValue,
  catalogueGapsOf,
  deriveWhereItIs,
  zohoModuleOf,
} from "@auction/artwork-register-contracts";
import {
  ADMIN_REGISTER_PAGE_SIZE,
  type AdminAuctionOfferAssessment,
  type AdminRegisterAllItem,
  type AdminRegisterAllList,
  type AdminRegisterArtworkSummary,
  type AdminRegisterConflict,
  type AdminRegisterConflictList,
  type AdminRegisterCounts,
  type AdminRegisterDetail,
  type AdminRegisterLastCheck,
  type AdminRegisterNewList,
  type AdminRegisterQueueQuery,
  type AdminRegisterResolveBody,
  type AdminRegisterResolveResult,
  REGISTER_PLACE_VALUES,
} from "@auction/shop-contracts";
import type {
  ArtworkRegisterOverview,
  ArtworkRegisterQueue,
  ArtworkRegisterRecords,
  ConflictResolver,
  ListingRunReader,
  RegisterConflictRecord,
  RegisterOverviewFilter,
  RegisterOverviewRow,
  RegisterQueueFilter,
  SyncRunReader,
} from "../ports/artwork-register-review.ports.js";
import type { LaxArtListingReader } from "../ports/offer-on-lax-art.ports.js";
import type { StaffNameReader } from "../ports/staff-name.reader.js";
import { DRAFT_PROBE, laxArtOfferBlockers } from "./lax-art-offer-blockers.js";
import { presentRegisterEvent, staffIdsOf } from "./register-event.presenter.js";
import { presentWhereItIs } from "./where-it-is.presenter.js";

/** How much history one artwork's page shows. */
const HISTORY_LIMIT = 100;

export type ArtworkRegisterReviewDeps = {
  queue: ArtworkRegisterQueue;
  /** Every record with its place, for the All list. */
  overview: ArtworkRegisterOverview;
  register: ArtworkRegisterRecords;
  resolver: ConflictResolver;
  runs: SyncRunReader;
  /** The LAX listing LAX keeps on Zoho Products. */
  listingRuns: ListingRunReader;
  staffNames: StaffNameReader;
  /** Artworks Zoho says are sold that are still for sale; they wait in the same queue as conflicts. */
  soldAttention?: { countOpen(): Promise<number> };
  /** The lax.art listing made from a record, for "Where it is". */
  listings: LaxArtListingReader;
  /** Whether the record can be offered at auction, and the draft lot LAX Bid already holds. */
  auction: { assessRegister(registerId: string): Promise<AdminAuctionOfferAssessment> };
  now?: () => Date;
};

export type ResolveConflictOutcome =
  | { kind: "resolved"; result: AdminRegisterResolveResult }
  | {
      kind:
        | "not_found"
        | "already_resolved"
        | "cannot_accept_field"
        | "invalid_stock_code"
        | "stock_code_taken";
    };

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** A conflict's value as plain text: every LAX-owned field holds a short code or a name. */
function scalarOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function filterOf(query: AdminRegisterQueueQuery): RegisterQueueFilter {
  return {
    ...(query.artist ? { artistCode: query.artist } : {}),
    ...(query.missing ? { missing: query.missing } : {}),
  };
}

function overviewFilterOf(query: AdminRegisterQueueQuery): RegisterOverviewFilter {
  return {
    ...(query.artist ? { artistCode: query.artist } : {}),
    ...(query.place ? { place: query.place } : {}),
  };
}

/**
 * Where a record is, as far as the list can tell: the register's offer and a lax.art draft. A
 * withdrawn offer keeps reading Withdrawn here; the record page ages it back to Not offered. A
 * draft lot in LAX Bid is not visible from Shop, so the record page is where it shows.
 */
function placeOf({
  entry,
  hasLaxArtDraft,
}: RegisterOverviewRow): AdminRegisterAllItem["whereItIs"] {
  const { key, chip } = deriveWhereItIs({ offer: entry.offer, now: new Date(0), hasLaxArtDraft });
  return { key, chip };
}

function pageOf(query: AdminRegisterQueueQuery) {
  const page = query.page ?? 1;
  return { page, limit: ADMIN_REGISTER_PAGE_SIZE, offset: (page - 1) * ADMIN_REGISTER_PAGE_SIZE };
}

export function presentArtworkSummary(entry: ArtworkRegisterEntry): AdminRegisterArtworkSummary {
  return {
    registerId: entry.id,
    zohoProductId: entry.zohoProductId,
    title: entry.title,
    artistName: entry.artist.name,
    artistCode: entry.artist.code,
    stockCode: entry.stockCode,
    kind: entry.kind,
    zohoModule: zohoModuleOf(entry),
    missing: catalogueGapsOf(entry),
    zohoModifiedAt: iso(entry.zohoModifiedAt),
  };
}

export function presentConflict(conflict: RegisterConflictRecord): AdminRegisterConflict {
  return {
    conflictId: conflict.id,
    field: conflict.field,
    zohoValue: scalarOf(conflict.zohoValue),
    laxValue: scalarOf(conflict.laxValue),
    canAcceptZoho: canAcceptZohoValue(conflict.field),
    status: conflict.status,
    resolution: conflict.resolution,
    resolvedAt: iso(conflict.resolvedAt),
    zohoModifiedAt: conflict.zohoModifiedAt.toISOString(),
    detectedAt: conflict.detectedAt.toISOString(),
  };
}

/**
 * The From Zoho queue for LAX Admin: artworks that came in from Zoho and are not offered yet,
 * conflicts waiting for a decision, the latest nightly check, one artwork's record, and deciding
 * a conflict. Everything goes through the register's ports.
 */
export class ArtworkRegisterReviewService {
  constructor(private readonly deps: ArtworkRegisterReviewDeps) {}

  async listNew(query: AdminRegisterQueueQuery): Promise<AdminRegisterNewList> {
    const { page, limit, offset } = pageOf(query);
    const [held, artists, counts] = await Promise.all([
      this.deps.queue.listHeld(filterOf(query), { limit, offset }),
      this.deps.queue.listHeldArtists(),
      this.counts(),
    ]);
    return {
      items: held.entries.map(presentArtworkSummary),
      artists,
      total: held.total,
      page,
      pageSize: limit,
      counts,
    };
  }

  async listAll(query: AdminRegisterQueueQuery): Promise<AdminRegisterAllList> {
    const { page, limit, offset } = pageOf(query);
    const [all, artists, placeCounts, counts] = await Promise.all([
      this.deps.overview.listAll(overviewFilterOf(query), { limit, offset }),
      this.deps.overview.listArtists(),
      this.deps.overview.countPlaces(query.artist),
      this.counts(),
    ]);
    return {
      items: all.rows.map((row) => ({
        ...presentArtworkSummary(row.entry),
        whereItIs: placeOf(row),
      })),
      artists,
      places: REGISTER_PLACE_VALUES.map((value) => ({
        value,
        label: WHERE_IT_IS_CHIPS[value].label,
        count: placeCounts[value],
      })),
      total: all.total,
      page,
      pageSize: limit,
      counts,
    };
  }

  async listConflicts(query: AdminRegisterQueueQuery): Promise<AdminRegisterConflictList> {
    const { page, limit, offset } = pageOf(query);
    const [queued, counts] = await Promise.all([
      this.deps.queue.listOpenConflicts(filterOf(query), { limit, offset }),
      this.counts(),
    ]);
    return {
      items: queued.items.map(({ conflict, entry }) => ({
        conflict: presentConflict(conflict),
        artwork: presentArtworkSummary(entry),
      })),
      total: queued.total,
      page,
      pageSize: limit,
      counts,
    };
  }

  async lastCheck(): Promise<AdminRegisterLastCheck> {
    const [run, counts, listing] = await Promise.all([
      this.deps.runs.latestNightlyRun(),
      this.counts(),
      this.listingCheck(),
    ]);
    if (!run) return { counts, run: null, listing };
    return {
      counts,
      listing,
      run: {
        mode: run.mode,
        finishedAt: run.finishedAt.toISOString(),
        total: run.total,
        outcomes: run.byOutcome,
        skippedReasons: run.skippedReasons,
        gaps: run.gaps,
      },
    };
  }

  private async listingCheck(): Promise<AdminRegisterLastCheck["listing"]> {
    const [run, failedDeliveries] = await Promise.all([
      this.deps.listingRuns.latestRun(),
      this.deps.listingRuns.countFailedDeliveries(),
    ]);
    return {
      failedDeliveries,
      run: run
        ? {
            mode: run.mode,
            finishedAt: run.finishedAt.toISOString(),
            checked: run.checked,
            changed: run.changed,
            unchanged: run.unchanged,
            failed: run.failed,
            failures: run.failures,
          }
        : null,
    };
  }

  async get(registerId: string): Promise<AdminRegisterDetail | null> {
    const entry = await this.deps.register.findById(registerId);
    if (!entry) return null;
    const [conflicts, events, laxArt, auction] = await Promise.all([
      this.deps.queue.listConflictsFor(registerId),
      this.deps.register.listEvents(registerId, HISTORY_LIMIT),
      this.deps.listings.findByZohoProductId(entry.zohoProductId),
      this.deps.auction.assessRegister(registerId),
    ]);
    const names = await this.deps.staffNames.namesFor(staffIdsOf(events));
    return {
      registerId: entry.id,
      zohoProductId: entry.zohoProductId,
      stockCode: entry.stockCode,
      kind: entry.kind,
      zohoModule: zohoModuleOf(entry),
      title: entry.title,
      artistName: entry.artist.name,
      artistCode: entry.artist.code,
      medium: entry.medium,
      dimensions: entry.dimensions,
      year: entry.year,
      imageCount: entry.imageRefs.length,
      catalogueStatus: entry.catalogueStatus,
      offerState: entry.offer.state,
      whereItIs: presentWhereItIs({
        entry,
        events,
        laxArt,
        bidDraft: auction.draftLot,
        now: (this.deps.now ?? (() => new Date()))(),
      }),
      laxArt,
      // The listing made from this record is the place; it does not block opening it again.
      offerBlockers: laxArt
        ? []
        : laxArtOfferBlockers(entry, DRAFT_PROBE).map(({ message, link }) => ({ message, link })),
      auctionBlockers: auction.blockers,
      missing: catalogueGapsOf(entry),
      zohoModifiedAt: iso(entry.zohoModifiedAt),
      createdAt: entry.createdAt.toISOString(),
      conflicts: conflicts.map(presentConflict),
      // Newest first, as the page reads it.
      events: events.map((event) => presentRegisterEvent(event, names)).reverse(),
    };
  }

  /** Records the decision under the staff member's id; the history keeps who decided and when. */
  async resolve(input: {
    conflictId: string;
    body: AdminRegisterResolveBody;
    actorSubjectId: string;
  }): Promise<ResolveConflictOutcome> {
    const result = await this.deps.resolver.resolveConflict({
      conflictId: input.conflictId,
      resolution: input.body.resolution,
      resolvedBy: `staff:${input.actorSubjectId}`,
      now: (this.deps.now ?? (() => new Date()))(),
    });
    if (!result.ok) return { kind: result.reason };
    return {
      kind: "resolved",
      result: {
        registerId: result.conflict.registerId,
        conflict: presentConflict(result.conflict),
      },
    };
  }

  /** How many artworks wait in each queue, for the Overview. */
  async queueCounts(): Promise<AdminRegisterCounts> {
    return this.counts();
  }

  private async counts() {
    const [created, conflicts, sold] = await Promise.all([
      this.deps.queue.countHeld(),
      this.deps.queue.countOpenConflicts(),
      this.deps.soldAttention?.countOpen() ?? 0,
    ]);
    return { new: created, decisions: conflicts + sold };
  }
}
