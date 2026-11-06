import {
  type EditionFactsSnapshot,
  type PrintDescription,
  describeSnapshotPrint,
  printLabel,
  readEditionSnapshot,
} from "@auction/shop-domain";

export type OrderLineEditionInput = {
  /** The run and facts kept when the order was paid; null before payment and on older orders. */
  snapshot: unknown;
  /** The run and facts as they stand now, used only while there is no snapshot. */
  live: EditionFactsSnapshot | undefined;
  /** Whether the order is paid and still holds the print, the only time its number is the buyer's. */
  holdsPrint: boolean;
  editionNumber: number | null;
  proofNumber: number | null;
};

/**
 * The sentences about the print on an order line. The facts kept at payment are what the buyer
 * was told, so they win over the run's facts today. The number appears only while the order holds
 * the print. Null when no facts are recorded, so callers show the plain edition instead.
 */
export function describeOrderLineEdition(input: OrderLineEditionInput): PrintDescription | null {
  const source = readEditionSnapshot(input.snapshot) ?? readEditionSnapshot(input.live);
  if (!source) return null;
  return describeSnapshotPrint(
    source,
    input.holdsPrint
      ? { editionNumber: input.editionNumber, proofNumber: input.proofNumber }
      : undefined,
  );
}

/**
 * The words after a print's title in a receipt: the facts the buyer was told when they paid, or
 * the print's own label ("7/24") while no facts are recorded. Null when the run is unknown or the
 * print has no number to give.
 */
export function describeReceiptEdition(input: OrderLineEditionInput): string | null {
  const described = describeOrderLineEdition(input);
  if (described) return described.summary;
  const source = readEditionSnapshot(input.snapshot) ?? readEditionSnapshot(input.live);
  const stockRef = input.editionNumber ?? input.proofNumber;
  if (!source || !input.holdsPrint || stockRef === null) return null;
  return printLabel(
    { editionNumber: input.editionNumber, proofNumber: input.proofNumber, stockRef },
    source.run,
  );
}
