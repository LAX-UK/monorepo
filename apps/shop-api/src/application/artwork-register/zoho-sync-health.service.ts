import {
  type OfferState,
  WHERE_IT_IS_CHIPS,
  ZOHO_TOKEN_FAILING_STREAK,
} from "@auction/artwork-register-contracts";
import {
  ADMIN_ZOHO_DRIFT_PAGE_SIZE,
  type AdminZohoDriftQuery,
  type AdminZohoProductWithoutRegisterList,
  type AdminZohoRegisterWithoutProductList,
  type AdminZohoStatusMismatchList,
  type AdminZohoSyncHealth,
  type ZohoTokenStatus,
} from "@auction/shop-contracts";
import type { SyncRunReader, SyncRunSummary } from "../ports/artwork-register-review.ports.js";
import type { ListingRunReader } from "../ports/artwork-register-review.ports.js";
import type {
  ZohoDriftReader,
  ZohoOutboundQueueReader,
  ZohoSyncHealthReader,
  ZohoSyncHealthRecord,
} from "../ports/zoho-sync-health.ports.js";

/** A token that has not refreshed for this long, while the sync is on, is worth a look. */
export const TOKEN_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Test artists are left out on purpose, so they are not a failure of the pass. */
const INTENTIONAL_SKIP = "demo_artist";

export type ZohoSyncHealthDeps = {
  health: ZohoSyncHealthReader;
  inboundRuns: SyncRunReader;
  listingRuns: Pick<ListingRunReader, "latestRun">;
  outbound: ZohoOutboundQueueReader;
  drift: ZohoDriftReader;
  now?: () => Date;
};

const iso = (date: Date | null) => date?.toISOString() ?? null;

function pageOf(query: AdminZohoDriftQuery) {
  const page = query.page ?? 1;
  return {
    page,
    limit: ADMIN_ZOHO_DRIFT_PAGE_SIZE,
    offset: (page - 1) * ADMIN_ZOHO_DRIFT_PAGE_SIZE,
  };
}

function placeLabel(state: OfferState): string {
  return WHERE_IT_IS_CHIPS[state === "held" ? "not_offered" : state].label;
}

export function tokenStatus(
  token: ZohoSyncHealthRecord["token"],
  syncOn: boolean,
  now: Date,
): ZohoTokenStatus {
  if (token.failureStreak >= ZOHO_TOKEN_FAILING_STREAK) return "failing";
  if (token.failureStreak > 0) return "warning";
  if (!token.refreshedAt) return "unknown";
  const stale = now.getTime() - token.refreshedAt.getTime() > TOKEN_STALE_AFTER_MS;
  return syncOn && stale ? "warning" : "ok";
}

function inboundRun(run: SyncRunSummary | null): AdminZohoSyncHealth["inbound"]["run"] {
  if (!run) return null;
  const intentional = run.skippedReasons.find((row) => row.reason === INTENTIONAL_SKIP)?.count ?? 0;
  return {
    mode: run.mode,
    finishedAt: run.finishedAt.toISOString(),
    seen: run.total,
    changed: run.byOutcome.create + run.byOutcome.update,
    leftOut: Math.max(0, run.byOutcome.skipped - intentional),
    conflicts: run.byOutcome.conflict,
  };
}

/**
 * LAX Admin's Sync health tab: whether Zoho and LAX are keeping up with each other. Reads the
 * sync's own records and the delivery ledger; nothing here changes either.
 */
export class ZohoSyncHealthService {
  constructor(private readonly deps: ZohoSyncHealthDeps) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  async summary(): Promise<AdminZohoSyncHealth> {
    const [record, inbound, listing, outbound, drift] = await Promise.all([
      this.deps.health.read(),
      this.deps.inboundRuns.latestNightlyRun(),
      this.deps.listingRuns.latestRun(),
      this.deps.outbound.stats(),
      this.deps.drift.counts(),
    ]);
    const modes = record?.modes ?? null;
    const zohoOff = !modes || (modes.artworkSync === "off" && modes.listing === "off");
    const token = record?.token ?? {
      refreshedAt: null,
      expiresAt: null,
      failureStreak: 0,
      lastFailureAt: null,
    };
    return {
      modes:
        modes && record?.modesReportedAt
          ? { ...modes, reportedAt: record.modesReportedAt.toISOString() }
          : null,
      zohoOff,
      inbound: { run: inboundRun(inbound) },
      listing: {
        run: listing
          ? {
              mode: listing.mode,
              finishedAt: listing.finishedAt.toISOString(),
              checked: listing.checked,
              drift: listing.changed,
              failed: listing.failed,
            }
          : null,
      },
      outbound: {
        depth: outbound.depth,
        oldestPendingAt: iso(outbound.oldestPendingAt),
        deadLettered: outbound.deadLettered,
      },
      token: {
        status: tokenStatus(token, !zohoOff, this.now()),
        refreshedAt: iso(token.refreshedAt),
        expiresAt: iso(token.expiresAt),
        failureStreak: token.failureStreak,
        lastFailureAt: iso(token.lastFailureAt),
      },
      drift: {
        registerWithoutProduct: drift.registerWithoutProduct,
        productsWithoutRegister: drift.productsWithoutRegister,
        statusMismatch: drift.statusMismatches,
      },
    };
  }

  async registerWithoutProduct(
    query: AdminZohoDriftQuery,
  ): Promise<AdminZohoRegisterWithoutProductList> {
    const { page, limit, offset } = pageOf(query);
    const { rows, total } = await this.deps.drift.registerWithoutProduct({ limit, offset });
    return {
      items: rows.map((row) => ({
        registerId: row.registerId,
        stockCode: row.stockCode,
        title: row.title,
        artistName: row.artistName,
        place: placeLabel(row.offerState),
        foundAt: row.foundAt.toISOString(),
      })),
      total,
      page,
      pageSize: limit,
    };
  }

  async productsWithoutRegister(
    query: AdminZohoDriftQuery,
  ): Promise<AdminZohoProductWithoutRegisterList> {
    const { page, limit, offset } = pageOf(query);
    const { rows, total } = await this.deps.drift.productsWithoutRegister({ limit, offset });
    return {
      items: rows.map((row) => ({ ...row, foundAt: row.foundAt.toISOString() })),
      total,
      page,
      pageSize: limit,
    };
  }

  async statusMismatches(query: AdminZohoDriftQuery): Promise<AdminZohoStatusMismatchList> {
    const { page, limit, offset } = pageOf(query);
    const { rows, total } = await this.deps.drift.statusMismatches({ limit, offset });
    return {
      items: rows.map((row) => ({
        registerId: row.registerId,
        stockCode: row.stockCode,
        title: row.title,
        artistName: row.artistName,
        place: placeLabel(row.offerState),
        zohoStatus: row.zohoStatus,
        expectedStatus: row.expectedStatus,
      })),
      total,
      page,
      pageSize: limit,
    };
  }
}
