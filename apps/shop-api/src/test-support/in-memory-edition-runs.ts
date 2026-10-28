import {
  type EditionAllocationKind,
  type EditionRunSpec,
  type RunUsage,
  ShopDomainError,
  assertValidRunSpec,
  planOpenEditionBatch,
} from "@auction/shop-domain";
import type {
  EditionRunTx,
  EditionRunUnitOfWork,
  RunArtwork,
  StoredFacts,
} from "../application/edition-runs/edition-run.ports.js";
import type {
  EditionRunConfig,
  EditionStockBatch,
} from "../application/ports/edition-run.repository.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";

export type MemoryPrint = {
  artworkId: string;
  stockRef: number;
  editionNumber: number | null;
  proofNumber: number | null;
  allocation: EditionAllocationKind;
  listingStatus: "not_authorised" | "authorised";
  custodyStatus: "unprinted" | "stored";
};

/**
 * An in-memory edition run store for the application services: artworks, runs, prints, facts,
 * stock batches and the audit log, with a clock-free version per facts save.
 */
export function createInMemoryEditionRuns() {
  const artworks = new Map<string, RunArtwork>();
  const runs = new Map<string, EditionRunConfig>();
  const facts = new Map<string, StoredFacts>();
  const usage = new Map<string, RunUsage>();
  const prints: MemoryPrint[] = [];
  const batches: EditionStockBatch[] = [];
  const audit: ShopAdminAuditRecord[] = [];
  const paidOrders = new Map<string, { orderId: string; reference: string; paidAt: Date }[]>();
  const snapshots = new Map<string, Record<string, unknown>>();
  let factsSaves = 0;
  let serial = 0;

  function addArtwork(patch: Partial<RunArtwork> & { artworkId: string }): RunArtwork {
    const artwork: RunArtwork = {
      artistId: "artist-1",
      slug: `artwork-${patch.artworkId}`,
      title: `Artwork ${patch.artworkId}`,
      sourceOriginalArtworkId: null,
      sellsPrints: true,
      updatedAt: new Date("2026-10-01T10:00:00.000Z"),
      ...patch,
    };
    artworks.set(artwork.artworkId, artwork);
    return artwork;
  }

  const tx: EditionRunTx = {
    runs: {
      async getRun(artworkId) {
        const config = runs.get(artworkId);
        return config ? { ...config, artworkId } : null;
      },
      async saveRun(artworkId, config) {
        assertValidRunSpec(config.spec);
        runs.set(artworkId, structuredClone(config));
      },
      async listStockBatches(artworkId) {
        return batches.filter((batch) => batch.artworkId === artworkId);
      },
      async addStockBatch(command) {
        const run = runs.get(command.artworkId);
        const open =
          run?.spec.type === "open" ||
          (run?.spec.type === "companion" && run.spec.run.type === "open");
        if (!open) throw new ShopDomainError("Prints can only be added to an open edition");
        const last = Math.max(
          0,
          ...prints.filter((p) => p.artworkId === command.artworkId).map((p) => p.stockRef),
        );
        const plan = planOpenEditionBatch({
          firstStockRef: last + 1,
          artistCount: command.artistCount,
          laxCount: command.laxCount,
        });
        for (const row of plan) {
          prints.push({
            artworkId: command.artworkId,
            stockRef: row.stockRef,
            editionNumber: null,
            proofNumber: null,
            allocation: row.allocation,
            listingStatus: "not_authorised",
            custodyStatus: command.custodyStatus,
          });
        }
        const batch: EditionStockBatch = {
          id: `batch-${++serial}`,
          artworkId: command.artworkId,
          firstStockRef: last + 1,
          quantity: plan.length,
          artistCount: command.artistCount,
          laxCount: command.laxCount,
          custodyStatus: command.custodyStatus,
          storageLocation: command.storageLocation ?? null,
          addedBySubjectId: command.addedBySubjectId,
          createdAt: new Date(),
        };
        batches.push(batch);
        return batch;
      },
    },
    prints: {
      async lockArtwork(artworkId) {
        return artworks.get(artworkId) ?? null;
      },
      async usage(artworkId) {
        return usage.get(artworkId) ?? { printsAuthorised: 0, paidOrders: 0 };
      },
      async createPrints({ artworkId, plan }) {
        for (const row of plan) {
          prints.push({
            artworkId,
            stockRef: row.stockRef,
            editionNumber: row.editionNumber,
            proofNumber: row.proofNumber,
            allocation: row.allocation,
            listingStatus: "not_authorised",
            custodyStatus: "unprinted",
          });
        }
        return plan.length;
      },
      async clearPrints(artworkId) {
        for (let i = prints.length - 1; i >= 0; i -= 1) {
          if (prints[i]?.artworkId === artworkId) prints.splice(i, 1);
        }
      },
      async authoriseLaxPrints({ artworkId, stockRefs }) {
        let changed = 0;
        for (const print of prints) {
          if (
            print.artworkId === artworkId &&
            print.allocation === "lax" &&
            stockRefs.includes(print.stockRef)
          ) {
            print.listingStatus = "authorised";
            changed += 1;
          }
        }
        return changed;
      },
      async listedProofCount(mainRunId, proofType) {
        let listed = 0;
        for (const config of runs.values()) {
          if (
            config.spec.type === "proof" &&
            config.spec.mainRunId === mainRunId &&
            config.spec.proofType === proofType
          ) {
            listed += config.spec.size;
          }
        }
        return listed;
      },
      async touch(artworkId) {
        const artwork = artworks.get(artworkId);
        if (!artwork) throw new Error("missing artwork");
        artwork.updatedAt = new Date(artwork.updatedAt.getTime() + 1000);
        return artwork.updatedAt.toISOString();
      },
    },
    facts: {
      async get(artworkId) {
        return facts.get(artworkId) ?? null;
      },
      async save(artworkId, value) {
        factsSaves += 1;
        const version = new Date(Date.UTC(2026, 9, 1, 12, 0, factsSaves)).toISOString();
        facts.set(artworkId, { facts: structuredClone(value), version });
        return version;
      },
      async paidOrders(artworkId) {
        return paidOrders.get(artworkId) ?? [];
      },
      async keepOrderSnapshots(artworkId, snapshot) {
        const orders = paidOrders.get(artworkId) ?? [];
        let kept = 0;
        for (const order of orders) {
          if (!snapshots.has(order.orderId)) {
            snapshots.set(order.orderId, snapshot);
            kept += 1;
          }
        }
        return kept;
      },
    },
    listings: {
      async copyFromMainRun(input) {
        const main = artworks.get(input.mainArtworkId);
        if (!main) throw new Error("missing main");
        let slug = input.slug;
        const taken = () => [...artworks.values()].some((a) => a.slug === slug);
        if (input.onSlugTaken === "next_free") {
          for (let n = 2; taken(); n += 1) slug = `${input.slug}-${n}`;
        } else if (taken()) {
          throw new ShopDomainError("That slug is already used by another artwork.");
        }
        const copy = addArtwork({
          artworkId: `listing-${++serial}`,
          artistId: main.artistId,
          slug,
          title: input.title,
          sourceOriginalArtworkId: main.sourceOriginalArtworkId,
        });
        return { artworkId: copy.artworkId, slug, version: copy.updatedAt.toISOString() };
      },
    },
    audit: {
      async append(record) {
        audit.push(record);
      },
    },
    commands: {
      async begin() {
        return { kind: "started" };
      },
      async complete() {},
    },
  };

  const uow: EditionRunUnitOfWork = {
    run: (fn) => fn(tx),
    bind: () => tx,
  };

  return {
    uow,
    tx,
    artworks,
    runs,
    facts,
    usage,
    prints,
    batches,
    audit,
    paidOrders,
    snapshots,
    addArtwork,
    printsOf: (artworkId: string) => prints.filter((print) => print.artworkId === artworkId),
    specOf: (artworkId: string): EditionRunSpec | undefined => runs.get(artworkId)?.spec,
  };
}
