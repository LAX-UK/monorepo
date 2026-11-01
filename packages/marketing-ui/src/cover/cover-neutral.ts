import type { CoverAction, CoverSlide } from "./cover-types.js";

export type NeutralCoverInput = {
  title: string;
  fact?: string;
  primary: CoverAction;
};

/**
 * The cover shown when the data could not be read: type on the page tone, one sentence and one
 * way on. No status, no time, no picture, so it never claims anything about a sale.
 */
export function neutralCoverSlide(input: NeutralCoverInput): CoverSlide {
  return {
    id: "neutral",
    title: input.title,
    ...(input.fact ? { fact: input.fact } : {}),
    primary: input.primary,
    media: [],
  };
}
