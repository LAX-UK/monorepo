"use client";

import { useClockTick } from "@auction/ui/clock";
import { coverTickText } from "./cover-clock.js";
import type { CoverTimeTick } from "./cover-types.js";

const SECOND_MS = 1000;

/**
 * The cover's time line. Static text, except in the final hour, when the clock counts every
 * second. It starts from the text the server drew, so hydration matches, then takes the time
 * from the shared clock. Reduced motion changes nothing here: the text is replaced in place
 * and nothing is animated. Figures are tabular so the line does not move as they change, and the
 * text is not a live region, because a second-by-second announcement would be noise.
 */
export function CoverTimeLine({ text, tick }: { text: string; tick?: CoverTimeTick | undefined }) {
  const endsAt = tick?.endsAt;
  const template = tick?.template;
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  const counting = Number.isFinite(end) && Boolean(template);

  // Wakes once a second while there is something to count, and never otherwise.
  const now = useClockTick(
    (nowMs) => (counting && end > nowMs ? SECOND_MS - (nowMs % SECOND_MS) + 1 : null),
    { key: `${endsAt ?? ""}|${template ?? ""}` },
  );

  const shown = counting && template && now !== null ? coverTickText(template, end - now) : text;
  return <span className="font-medium tabular-nums">{shown}</span>;
}
