"use client";

import { readConsentFromDocument } from "./consent-headers";
import { isConsentBannerDisabled } from "./consent/disable-banner";
import { isAnalyticsEnabled } from "./is-enabled";

function guardAnalytics(): boolean {
  if (!isAnalyticsEnabled()) return false;
  if (isConsentBannerDisabled()) return true;
  const c = readConsentFromDocument();
  return c?.analytics === true;
}

function pushSellEvent(event: string, payload: Record<string, unknown> = {}): void {
  if (!guardAnalytics() || typeof window === "undefined") return;
  const eventId = crypto.randomUUID();
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, event_id: eventId, ...payload });
}

export function trackSellCtaClick(source: string): void {
  pushSellEvent("sell_cta_click", { source });
}

export function trackSellAuthHandoff(): void {
  pushSellEvent("sell_auth_handoff");
}

export function trackWizardStepComplete(stepId: string, stepIndex: number): void {
  pushSellEvent("wizard_step_complete", { step_id: stepId, step_index: stepIndex });
}

export function trackWizardSubmit(submissionId: string): void {
  pushSellEvent("wizard_submit", { submission_id: submissionId });
}

export function trackStaffAccept(submissionId: string): void {
  pushSellEvent("staff_accept", { submission_id: submissionId });
}

export function trackStaffConvert(submissionId: string): void {
  pushSellEvent("staff_convert", { submission_id: submissionId });
}

export function trackSellerConnectComplete(): void {
  pushSellEvent("seller_connect_complete");
}
