import {
  type EditionRunSpec,
  type ExpectedPrint,
  type SendCandidate,
  printLabel,
} from "@auction/shop-domain";
import type { PackLine, PackPrint, RunContext, RunPrint } from "./print-fulfilment.ports.js";

/** "7/24", "AP 2/3" or "OE-0021". */
export function labelOfPrint(print: PackPrint | RunPrint, spec: EditionRunSpec): string {
  return printLabel(
    {
      editionNumber: print.editionNumber,
      proofNumber: print.proofNumber,
      stockRef: print.stockRef,
    },
    spec,
  );
}

/** Whether the run numbers its prints, so packing must check the number. */
export function isNumberedRun(context: Pick<RunContext, "facts">): boolean {
  return context.facts !== null && context.facts.numbering !== "none";
}

export function expectedPrintOf(line: PackLine, spec: EditionRunSpec): ExpectedPrint {
  return {
    editionId: line.print.editionId,
    label: labelOfPrint(line.print, spec),
    labelCode: line.print.labelCode,
    // The print now belongs to the buyer; the seller is who a swap must keep the payout for.
    ownerPartyId: line.sellerPartyId,
  };
}

export function candidatesOf(prints: readonly RunPrint[], spec: EditionRunSpec): SendCandidate[] {
  return prints.map((print) => ({ ...print, label: labelOfPrint(print, spec) }));
}
