import {
  type ParticipationStepKey,
  getOnlineCloseStepDescription,
  getSaleTypePresentation,
} from "@/lib/sale-type-presentation";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { isSaleroomGatedForOnlineBids, saleModeAllowsStreamUrl } from "@auction/validators";

export type SaleFormatExplainerContext = {
  deliveryMode: SaleDeliveryMode;
  saleEndTime?: Date | string | null;
  streamUrl?: string | null;
  allowOnlineBidsBeforeGoLive?: boolean;
};

export type SaleFormatExplainerViewModel = {
  mode: SaleDeliveryMode;
  title: string;
  tagline: string;
  description: string;
  steps: Array<{ title: string; description: string }>;
  footnotes: string[];
  iconName: "Laptop" | "MapPin";
  colorClass: string;
};

const HYBRID_GATED_DESCRIPTION =
  "This sale supports in-room and online participation. Online bidding opens when the clerk puts each lot on the block during the live saleroom session. Collect a paddle at reception, submit telephone or absentee instructions before lots open, or follow the saleroom broadcast when available.";

const HYBRID_UNGATED_DESCRIPTION =
  "This sale supports online bidding and in-room participation. Register to bid on the website, or collect a paddle at reception and bid live in the saleroom. Telephone and absentee instructions are also available before lots open.";

const HYBRID_GATED_ONLINE_STEP =
  "Place bids on the website when the clerk puts the lot on the block, or bid through a clerk with your paddle number in the saleroom.";

const STREAM_AVAILABLE =
  "A live stream is available for this sale — watch the saleroom session from your device.";

const STREAM_UNAVAILABLE =
  "A live stream is not listed for this sale. Check back closer to the session or contact the saleroom.";

function hasStreamUrl(streamUrl: string | null | undefined): boolean {
  return typeof streamUrl === "string" && streamUrl.trim().length > 0;
}

function resolveHybridDescription(ctx: SaleFormatExplainerContext): string {
  const gated = isSaleroomGatedForOnlineBids({
    deliveryMode: "hybrid",
    allowOnlineBidsBeforeGoLive: ctx.allowOnlineBidsBeforeGoLive,
  });
  return gated ? HYBRID_GATED_DESCRIPTION : HYBRID_UNGATED_DESCRIPTION;
}

function resolveStepDescription(
  ctx: SaleFormatExplainerContext,
  stepKey: ParticipationStepKey,
  baseDescription: string,
): string | null {
  if (stepKey === "lotClose" && ctx.deliveryMode === "online") {
    return getOnlineCloseStepDescription(ctx.saleEndTime);
  }

  if (stepKey === "maxBids" && ctx.deliveryMode === "hybrid") {
    const gated = isSaleroomGatedForOnlineBids({
      deliveryMode: "hybrid",
      allowOnlineBidsBeforeGoLive: ctx.allowOnlineBidsBeforeGoLive,
    });
    return gated ? HYBRID_GATED_ONLINE_STEP : baseDescription;
  }

  if (stepKey === "stream") {
    if (!saleModeAllowsStreamUrl(ctx.deliveryMode)) {
      return null;
    }
    return hasStreamUrl(ctx.streamUrl) ? STREAM_AVAILABLE : null;
  }

  return baseDescription;
}

function shouldIncludeStep(
  ctx: SaleFormatExplainerContext,
  stepKey: ParticipationStepKey,
): boolean {
  if (stepKey === "stream") {
    return saleModeAllowsStreamUrl(ctx.deliveryMode) && hasStreamUrl(ctx.streamUrl);
  }
  return true;
}

/** Context-aware format explainer copy for the sale help popover. */
export function resolveSaleFormatExplainer(
  ctx: SaleFormatExplainerContext,
): SaleFormatExplainerViewModel {
  const base = getSaleTypePresentation(ctx.deliveryMode);
  const resolvedDescription =
    ctx.deliveryMode === "hybrid" ? resolveHybridDescription(ctx) : base.description;

  const steps = base.howToTakePart.flatMap((step) => {
    if (!shouldIncludeStep(ctx, step.stepKey)) {
      return [];
    }
    const desc = resolveStepDescription(ctx, step.stepKey, step.description);
    if (desc == null) {
      return [];
    }
    return [{ title: step.title, description: desc }];
  });

  const footnotes: string[] = [];
  if (saleModeAllowsStreamUrl(ctx.deliveryMode) && !hasStreamUrl(ctx.streamUrl)) {
    footnotes.push(STREAM_UNAVAILABLE);
  }

  return {
    mode: base.key,
    title: base.title,
    tagline: base.tagline,
    description: resolvedDescription,
    steps,
    footnotes,
    iconName: base.iconName,
    colorClass: base.colorClass,
  };
}

/** Accessible label for the format help trigger. */
export function saleFormatExplainerAriaLabel(mode: SaleDeliveryMode): string {
  const label = getSaleTypePresentation(mode).label.toLowerCase();
  return `About this ${label} auction format`;
}

/** Build explainer context from a sale record. */
export function saleFormatExplainerContextFromSale(
  sale: Pick<Sale, "deliveryMode" | "endTime" | "streamUrl" | "allowOnlineBidsBeforeGoLive">,
): SaleFormatExplainerContext {
  return {
    deliveryMode: sale.deliveryMode,
    saleEndTime: sale.endTime,
    streamUrl: sale.streamUrl,
    allowOnlineBidsBeforeGoLive: sale.allowOnlineBidsBeforeGoLive,
  };
}
