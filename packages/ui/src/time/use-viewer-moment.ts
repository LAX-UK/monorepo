"use client";

import { type MomentDescription, type ViewerZone, describeMoment } from "@auction/datetime";
import { useMemo } from "react";
import { useViewerZone } from "./viewer-zone-context.js";

/**
 * A moment read against the visitor's own clock. `viewer` is the zone the page is using; `moment`
 * describes the instant (its `local` is `null` when the visitor's clock reads the same, or their
 * zone is unknown, UTC included) and is `null` when there is no instant to describe. Every time
 * surface reads the moment through here.
 */
export function useViewerMoment(
  instant: string | null,
  officialZone: string,
): { viewer: ViewerZone; moment: MomentDescription | null } {
  const viewer = useViewerZone();
  const moment = useMemo(() => {
    if (!instant) return null;
    const at = new Date(instant);
    return describeMoment(at, { officialZone, viewerZone: viewer?.zone ?? null, now: at });
  }, [instant, officialZone, viewer?.zone]);
  return { viewer, moment };
}
