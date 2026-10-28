import type { shopArtwork } from "@auction/db/schema";
import {
  type EditionRunSpec,
  type MainRunSpec,
  type ProofType,
  type ProofsKept,
  ShopDomainError,
  assertValidRunSpec,
} from "@auction/shop-domain";
import type {
  EditionRunConfig,
  StoredEditionRun,
} from "../application/ports/edition-run.repository.js";

type ArtworkRow = typeof shopArtwork.$inferSelect;

type ProofsKeptColumns = Pick<
  ArtworkRow,
  "proofsKeptAp" | "proofsKeptPp" | "proofsKeptHc" | "proofsKeptBat"
>;

/** The columns of shop_artwork that describe a run. All null for an original. */
export type RunColumns = ProofsKeptColumns &
  Pick<
    ArtworkRow,
    | "runKind"
    | "runRole"
    | "runTemplate"
    | "runSize"
    | "allocBuyer"
    | "allocArtist"
    | "allocLax"
    | "openDefaultArtistPct"
    | "mainRunArtworkId"
    | "proofType"
  >;

type RunShapeColumns = Omit<RunColumns, keyof ProofsKeptColumns>;
type MainRunColumns = Omit<RunShapeColumns, "runRole" | "mainRunArtworkId" | "proofType">;

function mainRunColumns(run: MainRunSpec): MainRunColumns {
  switch (run.type) {
    case "lax_standard":
      return {
        runKind: "limited",
        runTemplate: "lax_standard",
        runSize: 24,
        allocBuyer: 10,
        allocArtist: 10,
        allocLax: 4,
        openDefaultArtistPct: null,
      };
    case "custom_limited":
      return {
        runKind: "limited",
        runTemplate: "custom",
        runSize: run.size,
        allocBuyer: run.allocation.buyer,
        allocArtist: run.allocation.artist,
        allocLax: run.allocation.lax,
        openDefaultArtistPct: null,
      };
    case "open":
      return {
        runKind: "open",
        runTemplate: null,
        runSize: null,
        allocBuyer: null,
        allocArtist: null,
        allocLax: null,
        openDefaultArtistPct: run.defaultSplit.artistPct,
      };
  }
}

function shapeColumns(spec: EditionRunSpec): RunShapeColumns {
  if (spec.type === "proof") {
    return {
      runKind: "limited",
      runRole: "proof",
      runTemplate: null,
      runSize: spec.size,
      allocBuyer: 0,
      allocArtist: spec.owner === "artist" ? spec.size : 0,
      allocLax: spec.owner === "lax" ? spec.size : 0,
      openDefaultArtistPct: null,
      mainRunArtworkId: spec.mainRunId,
      proofType: spec.proofType,
    };
  }
  if (spec.type === "companion") {
    return {
      ...mainRunColumns(spec.run),
      runRole: "companion",
      mainRunArtworkId: spec.mainRunId,
      proofType: null,
    };
  }
  return { ...mainRunColumns(spec), runRole: "main", mainRunArtworkId: null, proofType: null };
}

/** The columns to store for a run. Throws if the run breaks a rule. */
export function runToColumns(config: EditionRunConfig): RunColumns {
  assertValidRunSpec(config.spec);
  return {
    ...shapeColumns(config.spec),
    proofsKeptAp: config.proofsKept.ap,
    proofsKeptPp: config.proofsKept.pp,
    proofsKeptHc: config.proofsKept.hc,
    proofsKeptBat: config.proofsKept.bat,
  };
}

export function proofsKeptFromColumns(row: ProofsKeptColumns): ProofsKept {
  return {
    ap: row.proofsKeptAp ?? 0,
    pp: row.proofsKeptPp ?? 0,
    hc: row.proofsKeptHc ?? 0,
    bat: row.proofsKeptBat ?? 0,
  };
}

type RunRow = RunColumns & { id: string; sourceOriginalArtworkId: string | null };

function corrupt(artworkId: string, why: string): ShopDomainError {
  return new ShopDomainError(`The run stored for artwork ${artworkId} is not valid: ${why}`);
}

function mainSpecFromColumns(row: RunRow): MainRunSpec {
  if (row.runKind === "open") {
    const artistPct = row.openDefaultArtistPct;
    if (artistPct === null) throw corrupt(row.id, "an open run has no default split");
    return { type: "open", defaultSplit: { artistPct, laxPct: 100 - artistPct } };
  }
  if (row.runTemplate === "lax_standard") return { type: "lax_standard" };
  if (
    row.runTemplate !== "custom" ||
    row.runSize === null ||
    row.allocBuyer === null ||
    row.allocArtist === null ||
    row.allocLax === null
  ) {
    throw corrupt(row.id, "a limited run has no size or allocation");
  }
  return {
    type: "custom_limited",
    size: row.runSize,
    allocation: { buyer: row.allocBuyer, artist: row.allocArtist, lax: row.allocLax },
    linkedToOriginal: row.sourceOriginalArtworkId !== null,
  };
}

/**
 * Reads a run from its artwork row; null for an original. A proof listing needs the proofs its
 * main run kept, passed as `mainProofsKept`.
 */
export function runFromColumns(
  row: RunRow,
  mainProofsKept: ProofsKept | null,
): StoredEditionRun | null {
  if (row.runKind === null) return null;
  const proofsKept = proofsKeptFromColumns(row);
  if (row.runRole === "proof") {
    const type: ProofType | null = row.proofType;
    if (!type || !row.mainRunArtworkId || row.runSize === null || !mainProofsKept) {
      throw corrupt(row.id, "a proof listing is missing its type, size or main run");
    }
    return {
      artworkId: row.id,
      proofsKept,
      spec: {
        type: "proof",
        proofType: type,
        size: row.runSize,
        owner: (row.allocArtist ?? 0) > 0 ? "artist" : "lax",
        mainRunId: row.mainRunArtworkId,
        proofsKeptOnMain: mainProofsKept[type],
      },
    };
  }
  const run = mainSpecFromColumns(row);
  if (row.runRole === "companion") {
    if (!row.mainRunArtworkId) throw corrupt(row.id, "a companion listing has no main run");
    return {
      artworkId: row.id,
      proofsKept,
      spec: { type: "companion", mainRunId: row.mainRunArtworkId, run },
    };
  }
  return { artworkId: row.id, proofsKept, spec: run };
}
