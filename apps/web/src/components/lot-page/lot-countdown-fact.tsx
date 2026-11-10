"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type {
  LotInfoRow,
  LotInfoTone,
  LotRowCountdown,
  LotRowMoment,
} from "@/lib/lot-page/lot-time-rows";
import { useCountdown } from "@/lib/time/use-clock";
import type { CountdownContext, CountdownDisplay } from "@auction/domain";
import { useEffect, useRef, useState } from "react";
import { LotFact } from "./lot-fact";

/** Module constants, so the clock does not resubscribe on every render. */
const CONTEXTS: Readonly<Record<string, CountdownContext>> = {
  plain: {},
  extended: { extended: true },
  reduced: { reducedMotion: true },
  extendedReduced: { extended: true, reducedMotion: true },
};

function contextFor(extended: boolean, reduced: boolean): CountdownContext {
  const key = extended ? (reduced ? "extendedReduced" : "extended") : reduced ? "reduced" : "plain";
  return CONTEXTS[key] as CountdownContext;
}

type Face = {
  label: string;
  value: string;
  sub: string | null;
  tone: LotInfoTone;
  spoken?: string;
  /** Only while the second line is the official time: not for "The result follows in a moment". */
  moment?: LotRowMoment | undefined;
};

/** What the row prints for the clock's answer; the server's own text until the clock runs. */
export function faceOf(
  row: LotInfoRow,
  c: LotRowCountdown,
  display: CountdownDisplay | null,
): Face {
  const fallback: Face = {
    label: row.label,
    value: row.value,
    sub: row.sub,
    tone: row.tone,
    moment: row.moment,
  };
  if (!display) return fallback;
  switch (display.kind) {
    case "date":
      return {
        label: c.date.label,
        value: c.date.value,
        sub: c.date.sub,
        tone: "calm",
        moment: row.moment,
      };
    case "closing":
      return c.kind === "closes"
        ? {
            label: "Time left",
            value: "Closing…",
            sub: "The result follows in a moment",
            tone: "final",
          }
        : { label: "Opens", value: "Opening…", sub: c.sub, tone: "calm" };
    case "counting":
      return c.kind === "closes"
        ? {
            label: display.label,
            value: display.text,
            sub: c.sub,
            tone: display.tone,
            spoken: `${display.spoken} left`,
            moment: row.moment,
          }
        : {
            label: "Opens in",
            value: display.text,
            sub: c.sub,
            tone: "calm",
            spoken: `Opens in ${display.spoken}`,
            moment: row.moment,
          };
    default:
      return fallback;
  }
}

/** A late bid tints the value once for this long. */
const TINT_MS = 1200;
/** And at most once in this long, however fast the extensions come. */
const TINT_MIN_GAP_MS = 5000;

/** True for a moment after each new extension, unless the visitor wants less motion. */
function useExtensionTint(extensions: number, reduced: boolean): boolean {
  const seen = useRef(extensions);
  const lastAt = useRef(Number.NEGATIVE_INFINITY);
  const [tinted, setTinted] = useState(false);
  useEffect(() => {
    if (extensions <= seen.current) return;
    seen.current = extensions;
    const now = Date.now();
    if (reduced || now - lastAt.current < TINT_MIN_GAP_MS) return;
    lastAt.current = now;
    setTinted(true);
    const timer = setTimeout(() => setTinted(false), TINT_MS);
    return () => clearTimeout(timer);
  }, [extensions, reduced]);
  return tinted;
}

/**
 * The time fact for a lot that counts: the one part of the lot page that redraws as the seconds
 * change. It reads the shared clock for its own target and prints the label, tone and value the
 * countdown rule gives for the lot surface.
 */
export function LotCountdownFact({
  row,
  countdown,
}: {
  row: LotInfoRow;
  countdown: LotRowCountdown;
}) {
  const reduced = useReducedMotion();
  const display = useCountdown(countdown.targetMs, "lot", {
    ctx: contextFor(countdown.extended, reduced),
  });
  const tinted = useExtensionTint(countdown.extensions, reduced);
  const face = faceOf(row, countdown, display);
  return <LotFact {...face} clock={row.clock} tinted={tinted} />;
}
