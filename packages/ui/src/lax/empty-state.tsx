import { type LaxIllustrationName, laxDrawing } from "../components/ui/lax-illustration.js";
import { EmptyStateBase, type EmptyStateBaseProps } from "./empty-state-base.js";

export type EmptyStateProps = Omit<EmptyStateBaseProps, "drawing"> & {
  /**
   * The drawing from the shared LAX set, one per page: easel (start something), frame (nothing
   * on the wall), gavel (bids), parcel (purchases), ledger (money), plinth (a quiet list),
   * search (no results), lock (no access), ticket (not found) or askew (something went wrong).
   * The error variant always shows askew.
   */
  illustration: LaxIllustrationName;
};

/**
 * The empty state of the client workspace: the drawing on a warm-paper plate, a 20/28 title, a
 * sentence at reading line height and the action. Inline, it sits beside the text once the space
 * it sits in is 672px wide and stacks below that. As a page (`layout="page"`) it is a 5/7 grid
 * with a 4:3 plate, for not found and route errors; it carries the page's h1 unless told otherwise.
 * The layout and its options are `EmptyStateBase`'s; this picks the drawing by name.
 */
export function EmptyState({ illustration, ...props }: EmptyStateProps) {
  return (
    <EmptyStateBase drawing={{ name: illustration, paths: laxDrawing(illustration) }} {...props} />
  );
}
