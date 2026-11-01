"use client";

import { useEffect, useState } from "react";
import { coverTickText } from "./cover-clock.js";
import type { CoverTimeTick } from "./cover-types.js";

/**
 * The cover's time line. Static text, except in the final hour, when the clock counts every
 * second. It starts from the text the server drew, so hydration matches, then takes the time
 * from the visitor's clock. Reduced motion changes nothing here: the text is replaced in place
 * and nothing is animated. Figures are tabular so the line does not move as they change, and the
 * text is not a live region, because a second-by-second announcement would be noise.
 */
export function CoverTimeLine({ text, tick }: { text: string; tick?: CoverTimeTick | undefined }) {
  const [shown, setShown] = useState(text);
  const endsAt = tick?.endsAt;
  const template = tick?.template;

  useEffect(() => {
    setShown(text);
    if (!endsAt || !template) return;
    const end = Date.parse(endsAt);
    if (Number.isNaN(end)) return;
    const update = () => {
      const left = end - Date.now();
      setShown(coverTickText(template, left));
      return left;
    };
    if (update() <= 0) return;
    const timer = setInterval(() => {
      if (update() <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [text, endsAt, template]);

  return <span className="font-medium tabular-nums">{shown}</span>;
}
