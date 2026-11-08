import {
  type EditionFactRows,
  type EditionFacts,
  type Publisher,
  type Stamp,
  describeAlsoAvailable,
  describeEditionFacts,
  describeEditionRun,
} from "./edition-facts.js";
import {
  type EditionRunSpec,
  type ProofType,
  type ProofsKept,
  isOpenRun,
  runSize,
} from "./edition-run.js";

/**
 * The part of a run a storefront may know: its kind and size. Allocation, splits and owners stay
 * inside the shop; a page needs only enough to be told how to word the run.
 */
export type PublicEditionRun =
  | { kind: "limited"; size: number }
  | { kind: "open" }
  | { kind: "proof"; proofType: ProofType; size: number };

/** The confirmed facts as a storefront receives them: who confirmed them stays inside. */
export type PublicEditionFacts = Pick<EditionFacts, "numbering" | "signature" | "certificate"> & {
  stamp?: Stamp;
  printedBy?: string | null;
  publishedBy?: Publisher | null;
};

/** Proofs a main run kept, without the BAT proof, which is never listed or mentioned. */
export type PublicProofsKept = Pick<ProofsKept, "ap" | "pp" | "hc">;

/** The public shape of a run, from the stored one. A companion run reads as the run it carries. */
export function publicEditionRun(spec: EditionRunSpec): PublicEditionRun {
  if (spec.type === "proof") return { kind: "proof", proofType: spec.proofType, size: spec.size };
  const size = runSize(spec);
  return size === null || isOpenRun(spec) ? { kind: "open" } : { kind: "limited", size };
}

/** A run spec carrying only what wording reads; the splits are neutral and never shown. */
export function editionRunFromPublic(run: PublicEditionRun): EditionRunSpec {
  switch (run.kind) {
    case "open":
      return { type: "open", defaultSplit: { artistPct: 0, laxPct: 100 } };
    case "limited":
      return {
        type: "custom_limited",
        size: run.size,
        allocation: { buyer: 0, artist: 0, lax: run.size },
        linkedToOriginal: false,
      };
    case "proof":
      return {
        type: "proof",
        proofType: run.proofType,
        size: run.size,
        owner: "artist",
        mainRunId: "public",
        proofsKeptOnMain: run.size,
      };
  }
}

function toFacts(facts: PublicEditionFacts | null): EditionFacts | null {
  return facts ? { ...facts, confirmed: null } : null;
}

export type PublicEditionDescription = {
  /** "Limited edition print", "Open edition print" or "Artist's proof". */
  eyebrow: string;
  /** Edition, Signature, Number, Certificate, Stamp, Printed by, Published by, Proofs: null until staff confirm the facts. */
  rows: EditionFactRows | null;
  /** The edition row alone, which needs no confirmed facts. */
  edition: string;
  /** "Edition · Hand-signed · Numbered": one line for the basket and checkout. */
  basketLine: string | null;
  /** What a limited edition is, said once; null for an open run or a proof. */
  statement: string | null;
};

const LIMITED_STATEMENT =
  "A limited edition is a fixed number of prints from one image. No more will be made in this size and form.";

/** Every sentence a page says about one edition, written by the shared contract. */
export function describePublicEdition(input: {
  run: PublicEditionRun;
  facts: PublicEditionFacts | null;
  proofsKept?: PublicProofsKept | null;
}): PublicEditionDescription {
  const spec = editionRunFromPublic(input.run);
  const facts = toFacts(input.facts);
  const base = describeEditionRun(spec);
  const proofsKept = input.proofsKept ? { ...input.proofsKept, bat: 0 } : undefined;
  const full = facts ? describeEditionFacts(spec, facts, proofsKept ? { proofsKept } : {}) : null;
  return {
    eyebrow: base.eyebrow,
    edition: base.edition,
    rows: full?.rows ?? null,
    basketLine: full?.basketLine ?? null,
    statement: input.run.kind === "limited" ? LIMITED_STATEMENT : null,
  };
}

/** "As an artist's proof", "Unsigned, open edition": how another run is named in a list. */
export function describeOtherRun(run: PublicEditionRun, facts: PublicEditionFacts | null): string {
  return describeAlsoAvailable(editionRunFromPublic(run), toFacts(facts));
}
