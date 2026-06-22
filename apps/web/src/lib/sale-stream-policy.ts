import type { SaleDeliveryMode } from "@auction/types";
import { saleModeAllowsStreamUrl } from "@auction/validators";

// ─── Core types ──────────────────────────────────────────────────────────────

export type StreamSurface = "lotPage" | "salePage";
export type StreamPhase = "upcoming" | "live" | "recording";

export type SaleStreamInput = {
  streamUrl: string | null | undefined;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  deliveryMode: SaleDeliveryMode;
  saleTitle?: string;
  endTime?: Date;
};

export type StreamPresentation = {
  phase: StreamPhase;
  sectionHeading: string;
  sectionBody: string;
  /** Full iframe title string (e.g. "Live stream: Evening Sale"). */
  embedTitle: string;
  /** DeferredLiveIframe click-to-load button label. */
  embedCtaLabel: string;
  /** External link label for non-embeddable or "open in provider" link. */
  externalLinkLabel: string;
  /** Whether the pulsing live icon should appear in section headings. */
  showPulseIcon: boolean;
  /** Tag to show in overview chips; null means suppress the stream tag entirely. */
  overviewTag: string | null;
};

export type SaleStreamContext = {
  hasStreamUrl: boolean;
  allowsStream: boolean;
  /** Null when status is draft/cancelled/voided or deliveryMode is online. */
  phase: StreamPhase | null;
  showOnLotPage: boolean;
  showOnSalePage: boolean;
  /**
   * Null when neither surface should show the stream (no URL, wrong mode, or
   * both showOnLotPage and showOnSalePage are false for a reason that makes
   * presentation irrelevant).
   */
  presentation: StreamPresentation | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

export function hasValidStreamUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.trim().length > 0;
}

/**
 * Maps sale lifecycle status to stream phase.
 * Returns null for statuses that never warrant a stream surface.
 */
export function resolveStreamPhase(status: SaleStreamInput["status"]): StreamPhase | null {
  switch (status) {
    case "scheduled":
      return "upcoming";
    case "active":
      return "live";
    case "ended":
      return "recording";
    default:
      return null;
  }
}

function buildPresentation(
  phase: StreamPhase,
  saleTitle: string,
  endTime: Date | undefined,
): StreamPresentation {
  switch (phase) {
    case "upcoming":
      return {
        phase,
        sectionHeading: "Live stream",
        sectionBody: "Broadcast available when the saleroom session opens.",
        embedTitle: `Live stream: ${saleTitle}`,
        embedCtaLabel: "Watch live",
        externalLinkLabel: "Open live stream",
        showPulseIcon: false,
        overviewTag: "Live stream",
      };

    case "live":
      return {
        phase,
        sectionHeading: "Live stream",
        sectionBody: "Follow the auction as it happens in the saleroom.",
        embedTitle: `Live stream: ${saleTitle}`,
        embedCtaLabel: "Watch live",
        externalLinkLabel: "Open live stream",
        showPulseIcon: true,
        overviewTag: "Live stream",
      };

    case "recording": {
      const dateSuffix = endTime
        ? ` · ${endTime.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : "";
      return {
        phase,
        sectionHeading: "Saleroom recording",
        sectionBody: `Watch the full ${saleTitle} auction as it happened${dateSuffix}.`,
        embedTitle: `Saleroom recording: ${saleTitle}`,
        embedCtaLabel: "Watch recording",
        externalLinkLabel: "Open recording",
        showPulseIcon: false,
        overviewTag: "Saleroom recording",
      };
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Whether the stream should appear on a given surface.
 *
 * - lotPage:  scheduled + active only (viewer can watch while bidding)
 * - salePage: scheduled + active + ended (recording archive)
 */
export function shouldShowStreamOnSurface(input: SaleStreamInput, surface: StreamSurface): boolean {
  if (!hasValidStreamUrl(input.streamUrl)) return false;
  if (!saleModeAllowsStreamUrl(input.deliveryMode)) return false;

  const phase = resolveStreamPhase(input.status);
  if (phase === null) return false;

  if (surface === "lotPage") return phase === "upcoming" || phase === "live";
  // salePage
  return phase === "upcoming" || phase === "live" || phase === "recording";
}

/**
 * Returns the copy/label bundle for a given surface, or null when the stream
 * should not appear on that surface.
 */
export function resolveStreamPresentation(
  input: SaleStreamInput,
  surface: StreamSurface,
): StreamPresentation | null {
  if (!shouldShowStreamOnSurface(input, surface)) return null;
  const phase = resolveStreamPhase(input.status) as StreamPhase;
  return buildPresentation(phase, input.saleTitle ?? "this sale", input.endTime);
}

/**
 * Primary entry point — computes the full stream context used by mappers and
 * page components. Call once per page render; pass derived booleans down to
 * child components.
 */
export function resolveSaleStreamContext(input: SaleStreamInput): SaleStreamContext {
  const hasStreamUrl = hasValidStreamUrl(input.streamUrl);
  const allowsStream = saleModeAllowsStreamUrl(input.deliveryMode);
  const phase = resolveStreamPhase(input.status);

  const showOnLotPage = shouldShowStreamOnSurface(input, "lotPage");
  const showOnSalePage = shouldShowStreamOnSurface(input, "salePage");

  // Build presentation using the most permissive surface that is visible,
  // preferring salePage since it covers the recording phase too.
  const presentation = showOnSalePage
    ? resolveStreamPresentation(input, "salePage")
    : showOnLotPage
      ? resolveStreamPresentation(input, "lotPage")
      : null;

  return {
    hasStreamUrl,
    allowsStream,
    phase,
    showOnLotPage,
    showOnSalePage,
    presentation,
  };
}
