/**
 * Whether a lot can hand its artwork back to lax.art, as LAX Bid's API reports it. A lot with no
 * link to the artwork register has nothing to move, so the action is not offered at all.
 */
export type LaxArtReturnView =
  | { linked: false }
  | {
      linked: true;
      /** The artwork's title in the register. */
      title: string;
      stockCode: string;
      canReturn: boolean;
      /** Why not, in words for staff. Empty when it can. */
      reasons: string[];
    };

/** What the lot actions need: the view when the lot is linked, otherwise nothing. */
export function laxArtReturnTarget(view: LaxArtReturnView | null | undefined) {
  return view?.linked ? view : null;
}

/** What staff are told after a return, from the API's answer. */
export type LaxArtReturnOutcome = {
  laxArtListing: boolean;
  hint?: string | undefined;
};

/** The toast for a finished return: a lax.art draft, or the register alone when it was never listed. */
export function laxArtReturnSuccessMessage(
  title: string,
  outcome: LaxArtReturnOutcome | null,
): string {
  if (outcome && !outcome.laxArtListing) {
    return `${title} is back with LAX. It was never listed on lax.art, so no draft was made.`;
  }
  return `${title} is back on lax.art as a draft`;
}

/** The line under the toast: the API's hint, only when there was no lax.art listing. */
export function laxArtReturnSuccessHint(outcome: LaxArtReturnOutcome | null): string {
  return outcome && !outcome.laxArtListing ? (outcome.hint ?? "") : "";
}
