"use client";

import { trackQuickLookEnrichmentMs } from "@/lib/analytics/events";
import { recordRecentlyViewedLot } from "@/lib/marketing/recently-viewed-lots";
import { useEffect, useState } from "react";
import {
  fetchLotQuickLookEnrichment,
  mergeLotQuickLookEnrichment,
} from "./fetch-lot-quick-look-enrichment.client";
import { emitQuickLookOpen } from "./lot-quick-look-analytics";
import type { LotQuickLookVM } from "./types";

type UseLotQuickLookEnrichmentInput = {
  activeVm: LotQuickLookVM | undefined;
  deckSourceLabel: string | undefined;
};

export function useLotQuickLookEnrichment({
  activeVm,
  deckSourceLabel,
}: UseLotQuickLookEnrichmentInput) {
  const [displayVm, setDisplayVm] = useState<LotQuickLookVM | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentAnnounce, setEnrichmentAnnounce] = useState("");

  useEffect(() => {
    if (!activeVm) {
      setDisplayVm(null);
      return;
    }
    setDisplayVm(activeVm);
    emitQuickLookOpen(activeVm.id, deckSourceLabel);
    recordRecentlyViewedLot({
      id: activeVm.id,
      href: activeVm.href,
      title: activeVm.title,
    });

    let cancelled = false;
    setEnriching(true);
    setEnrichmentAnnounce("");
    const started = performance.now();
    void fetchLotQuickLookEnrichment(activeVm.id).then((enrichment) => {
      if (cancelled) return;
      setDisplayVm((prev) => (prev ? mergeLotQuickLookEnrichment(prev, enrichment) : prev));
      setEnriching(false);
      trackQuickLookEnrichmentMs({
        lotId: activeVm.id,
        ms: Math.round(performance.now() - started),
      });
      if (enrichment?.medium || enrichment?.images?.length) {
        setEnrichmentAnnounce("Additional lot details loaded.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeVm, deckSourceLabel]);

  return { displayVm, enriching, enrichmentAnnounce };
}
