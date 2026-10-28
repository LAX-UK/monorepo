import type { ConsignmentAfterSaleStage } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui/components/dot-status-pill";

/** How each after-sale stage reads on a consignment; a new stage is a new entry. */
export const AFTER_SALE_STAGE_PRESENTATION: Record<
  ConsignmentAfterSaleStage,
  { label: string; hint: string; tone: DotStatusPillTone }
> = {
  unsold: {
    label: "Unsold",
    hint: "It did not sell this time. Choose what happens next below.",
    tone: "warning",
  },
  relist_requested: {
    label: "Relist requested",
    hint: "You asked to relist it. A specialist will confirm.",
    tone: "pending",
  },
  private_sale_requested: {
    label: "Private sale requested",
    hint: "You asked for a private sale. A specialist will confirm.",
    tone: "pending",
  },
  collect_requested: {
    label: "Return requested",
    hint: "You asked to have it returned. A specialist will confirm.",
    tone: "pending",
  },
  relist_confirmed: {
    label: "Relist confirmed",
    hint: "Your specialist confirmed it will be offered again in a future sale.",
    tone: "info",
  },
  private_sale_confirmed: {
    label: "Private sale confirmed",
    hint: "Your specialist confirmed it will be offered by private sale.",
    tone: "info",
  },
  collect_confirmed: {
    label: "Return confirmed",
    hint: "Your specialist confirmed it will be returned to you.",
    tone: "neutral",
  },
};
