import type { PrivateSaleDealStage, PrivateSaleStageChange } from "@auction/types";

export const PRIVATE_SALE_DEAL_EVENT_AGGREGATE = "private_sale_deal";

export type PrivateSaleDealEvent =
  | {
      eventType: "private_sale_deal.created";
      payload: { dealId: string; reference: string; stage: PrivateSaleDealStage };
    }
  | {
      eventType: "private_sale_deal.stage_changed";
      payload: {
        dealId: string;
        reference: string;
        from: PrivateSaleDealStage;
        to: PrivateSaleDealStage;
      };
    };

/**
 * The events a deal publishes carry identifiers and stage codes only. Names, prices, the cancel
 * reason and the parties stay on the deal, so the event log holds no personal data.
 */
export function dealCreatedEvent(deal: { id: string; reference: string }): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.created",
    payload: { dealId: deal.id, reference: deal.reference, stage: "proposed" },
  };
}

export function dealStageChangedEvent(
  deal: { id: string; reference: string },
  change: Pick<PrivateSaleStageChange, "from" | "to">,
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.stage_changed",
    payload: { dealId: deal.id, reference: deal.reference, from: change.from, to: change.to },
  };
}
