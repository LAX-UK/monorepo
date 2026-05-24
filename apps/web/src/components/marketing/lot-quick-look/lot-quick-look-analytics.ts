"use client";

import {
  trackQuickLookCtaClick,
  trackQuickLookDeckNav,
  trackQuickLookOpen,
} from "@/lib/analytics/events";

export function emitQuickLookOpen(lotId: string, source?: string): void {
  trackQuickLookOpen(source ? { lotId, source } : { lotId });
}

export function emitQuickLookDeckNav(lotId: string, direction: "prev" | "next"): void {
  trackQuickLookDeckNav({ lotId, direction });
}

export function emitQuickLookCta(lotId: string, cta: "bid" | "view_lot"): void {
  trackQuickLookCtaClick({ lotId, cta });
}
