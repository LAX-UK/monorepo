import type { HangLayout } from "@auction/marketing-ui/hang/hang-layout";

const SCALE_NOTE = "hung at true relative scale";

/** The line under a hang's title: the summary, then whether the wall is drawn to scale. */
export function hangMetaLine(summary: string, mode: HangLayout["mode"]): string {
  return `${summary} · ${mode === "scale" ? SCALE_NOTE : "Not to scale"}`;
}
