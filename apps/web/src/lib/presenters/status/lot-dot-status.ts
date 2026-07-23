import type { LotStatus } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";
import { presentationToDotStatus } from "@auction/ui";
import { resolveLotStatusPresentation } from "./resolver";

export type LotDotStatusContext = "sale-board" | "global";

export type LotDotStatusInput = {
  status: LotStatus;
  winnerId?: string | null | undefined;
  context?: LotDotStatusContext;
};

export type LotDotStatusPresentation = {
  label: string;
  tone: DotStatusPillTone;
};

function mapEndedTone(label: string, tone: DotStatusPillTone): LotDotStatusPresentation {
  if (label === "Sold") return { label, tone: "sold" };
  if (label === "Unsold") return { label, tone: "neutral" };
  return { label, tone };
}

/** Figma-aligned dot status label + tone for lot rows (sale board + global list). */
export function lotDotStatusPresentation(input: LotDotStatusInput): LotDotStatusPresentation {
  const { status, winnerId, context = "sale-board" } = input;

  if (status === "cancelled" || status === "voided") {
    if (context === "sale-board") {
      return { label: "Withdrawn", tone: "warning" };
    }
    const label = status === "cancelled" ? "Cancelled" : "Voided";
    return { label, tone: "critical" };
  }

  if (status === "scheduled" && context === "sale-board") {
    return { label: "Not started", tone: "pending" };
  }

  if (status === "ended" && context === "global") {
    return presentationToDotStatus(resolveLotStatusPresentation("ended"));
  }

  if (status === "active" && context === "sale-board") {
    return { label: "Live", tone: "live" };
  }

  const lotContext = status === "ended" && winnerId !== undefined ? { winnerId } : undefined;
  const presentation = presentationToDotStatus(resolveLotStatusPresentation(status, lotContext));

  if (status === "ended") {
    return mapEndedTone(presentation.label, presentation.tone);
  }

  return presentation;
}
