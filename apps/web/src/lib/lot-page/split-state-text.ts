export type StateLineParts = {
  /** The first sentence: what is true ("You've been outbid"). */
  title: string;
  /** What follows, or `null` when the line is one sentence. */
  detail: string | null;
};

/**
 * The domain writes a state line as one string; the page sets its first sentence as the title
 * and the rest beneath it. Splits at the first full stop followed by a space, so amounts such as
 * "£7,250.50" stay whole.
 */
export function splitStateText(text: string): StateLineParts {
  const at = text.search(/\.\s/);
  if (at === -1) return { title: text.replace(/\.$/, ""), detail: null };
  return {
    title: text.slice(0, at),
    detail: text.slice(at + 2).replace(/^\s+/, "") || null,
  };
}
