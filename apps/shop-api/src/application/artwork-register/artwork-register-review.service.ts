import { type ArtworkRegisterEntry, catalogueGapsOf } from "@auction/artwork-register-contracts";
import {
  ADMIN_REGISTER_PAGE_SIZE,
  type AdminRegisterArtworkSummary,
  type AdminRegisterConflict,
  type AdminRegisterConflictList,
  type AdminRegisterDetail,
  type AdminRegisterEvent,
  type AdminRegisterLastCheck,
  type AdminRegisterNewList,
  type AdminRegisterQueueQuery,
  type AdminRegisterResolveBody,
  type AdminRegisterResolveResult,
} from "@auction/shop-contracts";
import type {
  ArtworkRegisterQueue,
  ArtworkRegisterRecords,
  ConflictResolver,
  RegisterConflictRecord,
  RegisterEventRecord,
  RegisterQueueFilter,
  SyncRunReader,
} from "../ports/artwork-register-review.ports.js";

/** How much history one artwork's page shows. */
const HISTORY_LIMIT = 100;

export type ArtworkRegisterReviewDeps = {
  queue: ArtworkRegisterQueue;
  register: ArtworkRegisterRecords;
  resolver: ConflictResolver;
  runs: SyncRunReader;
  now?: () => Date;
};

export type ResolveConflictOutcome =
  | { kind: "resolved"; result: AdminRegisterResolveResult }
  | { kind: "not_found" }
  | { kind: "already_resolved" };

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

function pageOf(query: AdminRegisterQueueQuery) {
  const page = query.page ?? 1;
  return { page, limit: ADMIN_REGISTER_PAGE_SIZE, offset: (page - 1) * ADMIN_REGISTER_PAGE_SIZE };
}

export function presentArtworkSummary(entry: ArtworkRegisterEntry): AdminRegisterArtworkSummary {
  return {
    registerId: entry.id,
    title: entry.title,
    artistName: entry.artist.name,
    artistCode: entry.artist.code,
    stockCode: entry.stockCode,
    kind: entry.kind,
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
    status: conflict.status,
    resolution: conflict.resolution,
    resolvedAt: iso(conflict.resolvedAt),
    zohoModifiedAt: conflict.zohoModifiedAt.toISOString(),
    detectedAt: conflict.detectedAt.toISOString(),
  };
}

/** A staff member is not named on the page; the actor says only which kind of party acted. */
function presentEvent(event: RegisterEventRecord): AdminRegisterEvent {
  const actor = event.actor.startsWith("staff:")
    ? "staff"
    : event.actor === "zoho"
      ? "zoho"
      : "system";
  return {
    id: event.id,
    type: event.type,
    actor,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
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
    const [run, counts] = await Promise.all([this.deps.runs.latestNightlyRun(), this.counts()]);
    if (!run) return { counts, run: null };
    return {
      counts,
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

  async get(registerId: string): Promise<AdminRegisterDetail | null> {
    const entry = await this.deps.register.findById(registerId);
    if (!entry) return null;
    const [conflicts, events] = await Promise.all([
      this.deps.queue.listConflictsFor(registerId),
      this.deps.register.listEvents(registerId, HISTORY_LIMIT),
    ]);
    return {
      registerId: entry.id,
      zohoProductId: entry.zohoProductId,
      stockCode: entry.stockCode,
      kind: entry.kind,
      title: entry.title,
      artistName: entry.artist.name,
      artistCode: entry.artist.code,
      medium: entry.medium,
      dimensions: entry.dimensions,
      year: entry.year,
      imageCount: entry.imageRefs.length,
      catalogueStatus: entry.catalogueStatus,
      offerState: entry.offer.state,
      missing: catalogueGapsOf(entry),
      zohoModifiedAt: iso(entry.zohoModifiedAt),
      createdAt: entry.createdAt.toISOString(),
      conflicts: conflicts.map(presentConflict),
      // Newest first, as the page reads it.
      events: events.map(presentEvent).reverse(),
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

  private async counts() {
    const [created, decisions] = await Promise.all([
      this.deps.queue.countHeld(),
      this.deps.queue.countOpenConflicts(),
    ]);
    return { new: created, decisions };
  }
}
