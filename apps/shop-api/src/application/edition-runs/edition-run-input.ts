import type {
  AdminEditionFacts,
  AdminMainRunInput,
  AdminNewRunInput,
  AdminProofsKept,
  AdminStockBatchInput,
} from "@auction/shop-contracts";
import type { Certificate, EditionFacts, MainRunSpec, ProofsKept } from "@auction/shop-domain";

/** What a new run is recorded with: the run, its proofs kept and, when known, its facts. */
export type NewRunCommand = {
  spec: MainRunSpec;
  proofsKept: ProofsKept;
  facts: { facts: Omit<EditionFacts, "confirmed">; confirmed: boolean } | null;
  firstBatch: StockBatchCommand | null;
};

export type StockBatchCommand = {
  artistCount: number;
  laxCount: number;
  custodyStatus: "unprinted" | "stored";
  storageLocation: string | null;
};

export const NO_PROOFS_KEPT: ProofsKept = { ap: 0, pp: 0, hc: 0, bat: 0 };

/**
 * The run staff chose, in the shop domain's terms. Whether buyer prints are allowed follows the
 * original the artwork is linked to, which the caller knows and staff never type.
 */
export function mainRunSpec(input: AdminMainRunInput, linkedToOriginal: boolean): MainRunSpec {
  switch (input.type) {
    case "lax_standard":
      return { type: "lax_standard" };
    case "custom_limited":
      return {
        type: "custom_limited",
        size: input.size,
        allocation: { ...input.allocation },
        linkedToOriginal,
      };
    case "open":
      return {
        type: "open",
        defaultSplit: { artistPct: input.defaultArtistPct, laxPct: 100 - input.defaultArtistPct },
      };
  }
}

function certificate(input: AdminEditionFacts["certificate"]): Certificate {
  if (input.kind === "none") return { kind: "none" };
  const reason = input.numberedToMatchReason?.trim();
  return {
    kind: "included",
    issuer: input.issuer,
    form: input.form,
    arrives:
      input.arrives.kind === "with_print"
        ? { kind: "with_print" }
        : { kind: "separately", withinWeeks: input.arrives.withinWeeks },
    numberedToMatch: input.numberedToMatch,
    ...(reason ? { numberedToMatchReason: reason } : {}),
  };
}

/** The facts as the domain checks and describes them, without who confirmed them. */
export function editionFactsInput(input: AdminEditionFacts): Omit<EditionFacts, "confirmed"> {
  return {
    numbering: input.numbering,
    signature: { ...input.signature },
    certificate: certificate(input.certificate),
  };
}

export function stockBatchCommand(input: AdminStockBatchInput): StockBatchCommand {
  return {
    artistCount: input.artistCount,
    laxCount: input.laxCount,
    custodyStatus: input.custody,
    storageLocation: input.custody === "stored" ? input.storageLocation?.trim() || null : null,
  };
}

export function proofsKeptInput(input: AdminProofsKept | undefined): ProofsKept {
  return input ? { ...input } : { ...NO_PROOFS_KEPT };
}

/** Everything recorded with a new run except the run itself, which depends on the artwork. */
export function newRunCommand(input: AdminNewRunInput): Omit<NewRunCommand, "spec"> {
  return {
    proofsKept: proofsKeptInput(input.proofsKept),
    facts: input.facts
      ? { facts: editionFactsInput(input.facts), confirmed: input.factsConfirmed ?? false }
      : null,
    firstBatch: input.firstBatch ? stockBatchCommand(input.firstBatch) : null,
  };
}
