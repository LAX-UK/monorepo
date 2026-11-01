import type { Lot } from "@auction/types";

export type LotDetailFact = {
  label: string;
  text: string;
  /** Links inside the row ("Read the condition report", a document). */
  links?: { label: string; href: string }[];
};

export type LotDetailsView = {
  /** The cataloguer's note, as paragraphs. */
  about: string[];
  facts: LotDetailFact[];
};

type DetailsLot = Pick<Lot, "description" | "marketingDetails"> & {
  documents?: readonly { label: string; href: string }[];
};

type FactBuilder = (lot: DetailsLot) => LotDetailFact | null;

function nonEmpty(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

const provenance: FactBuilder = ({ marketingDetails }) => {
  const entries = (marketingDetails.provenance ?? [])
    .map((entry) => {
      const note = nonEmpty(entry.note);
      if (!note) return null;
      const period = nonEmpty(entry.period);
      return period ? `${period}: ${note}` : note;
    })
    .filter((line): line is string => line !== null);
  return entries.length > 0 ? { label: "Provenance", text: entries.join("; ") } : null;
};

const exhibited: FactBuilder = ({ marketingDetails }) => {
  const entries = (marketingDetails.exhibitions ?? [])
    .map((entry) => {
      const venue = nonEmpty(entry.venue);
      if (!venue) return null;
      const year = nonEmpty(entry.year);
      return year ? `${venue}, ${year}` : venue;
    })
    .filter((line): line is string => line !== null);
  return entries.length > 0 ? { label: "Exhibited", text: entries.join("; ") } : null;
};

const condition: FactBuilder = ({ marketingDetails }) => {
  const report = marketingDetails.conditionReport;
  const summary = nonEmpty(report?.summary);
  const href = nonEmpty(report?.downloadUrl);
  if (!summary && !href) return null;
  return {
    label: "Condition",
    text: summary ?? "A condition report is available.",
    ...(href ? { links: [{ label: "Read the condition report", href }] } : {}),
  };
};

const documents: FactBuilder = ({ documents: files }) =>
  files && files.length > 0
    ? { label: "Documents", text: "Available to read before you bid.", links: [...files] }
    : null;

/** One row per detail, in reading order; a lot with nothing to say for a row simply skips it. */
const FACT_BUILDERS: readonly FactBuilder[] = [provenance, exhibited, condition, documents];

function paragraphs(text: string | null): string[] {
  return (text ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The "About this work" text and the catalogue facts under it. */
export function buildLotDetails(lot: DetailsLot): LotDetailsView {
  return {
    about: paragraphs(nonEmpty(lot.description)),
    facts: FACT_BUILDERS.flatMap((build) => {
      const fact = build(lot);
      return fact ? [fact] : [];
    }),
  };
}

/** "Oil on canvas · 90 × 120 cm": the catalogue line under the title; empty parts are left out. */
export function lotFactsLine(lot: Pick<Lot, "medium" | "dimensions">): string | null {
  const parts = [
    nonEmpty(lot.medium),
    nonEmpty(lot.dimensions)?.replace(/\s*x\s*/gi, " × "),
  ].filter((part): part is string => part !== null && part !== undefined);
  return parts.length > 0 ? parts.join(" · ") : null;
}
