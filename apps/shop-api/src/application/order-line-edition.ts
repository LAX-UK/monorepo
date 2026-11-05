import {
  type EditionFactsSnapshot,
  type PrintDescription,
  describeSnapshotPrint,
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
