import { findPrintClaimWord } from "@auction/shop-domain";
import { PrintClaimError } from "../../errors/print-claim-error.js";

/**
 * Staff-typed Shop text may not make claims about a print: those belong in the Edition facts,
 * where the shop domain words them. Refuses the save with a plain message that names the first
 * field containing a claim word. `texts` is keyed by the form field the words were typed into.
 */
export function assertNoPrintClaims(
  texts: Readonly<Record<string, string | null | undefined>>,
  options: { certificateStated?: boolean } = {},
): void {
  for (const [field, text] of Object.entries(texts)) {
    if (text && findPrintClaimWord(text, options)) throw new PrintClaimError(field);
  }
}
