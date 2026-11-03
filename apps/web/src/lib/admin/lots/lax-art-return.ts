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
