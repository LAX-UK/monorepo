import type { EditorialBlock, EditorialInlineSpan } from "@auction/shop-contracts";

export type HowToBuyStep = {
  title: string;
  /** One entry per richText block. */
  paragraphs: EditorialInlineSpan[][];
  questions: string[];
};

export type HowToBuySteps = {
  /** Blocks before the first heading, rendered above the steps. */
  preamble: EditorialBlock[];
  steps: HowToBuyStep[];
};

const LEADING_NUMBER = /^\d+\s*[.)]\s*/;

/**
 * Maps a CMS body onto step cards: every level-2 heading opens a step holding the richText
 * and faqGroup blocks that follow it. Any other block inside a step, or fewer than two steps,
 * returns null so the page keeps rendering the body as authored.
 */
export function howToBuySteps(blocks: readonly EditorialBlock[]): HowToBuySteps | null {
  const preamble: EditorialBlock[] = [];
  const steps: HowToBuyStep[] = [];
  for (const block of blocks) {
    if (block.type === "heading" && block.level === 2) {
      // Cards are numbered by position, so a number typed into the heading would double up.
      steps.push({ title: block.text.replace(LEADING_NUMBER, ""), paragraphs: [], questions: [] });
      continue;
    }
    const step = steps.at(-1);
    if (!step) {
      preamble.push(block);
    } else if (block.type === "richText") {
      step.paragraphs.push(block.spans);
    } else if (block.type === "faqGroup") {
      step.questions.push(...block.items.map((item) => item.question));
    } else {
      return null;
    }
  }
  return steps.length >= 2 ? { preamble, steps } : null;
}
