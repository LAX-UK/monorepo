/**
 * The title steps down by length so it never needs a third line and is never cut: 56/60 on
 * desktop stepping to 44/52 and 36/44, and 30/36 on a phone stepping to 26/32.
 */

export type CoverTitleStep = {
  size: number;
  line: number;
  /** Letter spacing in em. */
  tracking: number;
};

type Step = CoverTitleStep & { maxChars: number };

const DESKTOP_STEPS: readonly Step[] = [
  { size: 56, line: 60, tracking: -0.02, maxChars: 36 },
  { size: 44, line: 52, tracking: -0.02, maxChars: 48 },
  { size: 36, line: 44, tracking: -0.015, maxChars: Number.POSITIVE_INFINITY },
];

const PHONE_STEPS: readonly Step[] = [
  { size: 30, line: 36, tracking: -0.015, maxChars: 40 },
  { size: 26, line: 32, tracking: -0.015, maxChars: Number.POSITIVE_INFINITY },
];

export type CoverTitleScale = { phone: CoverTitleStep; desktop: CoverTitleStep };

function pick(steps: readonly Step[], length: number): CoverTitleStep {
  const step = steps.find((candidate) => length <= candidate.maxChars) ?? steps[steps.length - 1];
  if (!step) throw new Error("cover_title_steps_empty");
  return { size: step.size, line: step.line, tracking: step.tracking };
}

export function coverTitleScale(title: string): CoverTitleScale {
  const length = [...title.trim()].length;
  return { phone: pick(PHONE_STEPS, length), desktop: pick(DESKTOP_STEPS, length) };
}

/** Static class names for every step, so the Tailwind scanner sees them. Keyed by size. */
const PHONE_CLASS: Record<number, string> = {
  30: "text-[30px] leading-[36px] tracking-[-0.015em]",
  26: "text-[26px] leading-[32px] tracking-[-0.015em]",
};
const DESKTOP_CLASS: Record<number, string> = {
  56: "md:text-[56px] md:leading-[60px] md:tracking-[-0.02em]",
  44: "md:text-[44px] md:leading-[52px] md:tracking-[-0.02em]",
  36: "md:text-[36px] md:leading-[44px] md:tracking-[-0.015em]",
};

export function coverTitleClass(title: string): string {
  const { phone, desktop } = coverTitleScale(title);
  return `${PHONE_CLASS[phone.size] ?? ""} ${DESKTOP_CLASS[desktop.size] ?? ""}`.trim();
}
