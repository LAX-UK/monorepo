import { SaleroomHeroAdaptive } from "@/components/sections/saleroom/saleroom-hero-adaptive";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleDeliveryMode } from "@auction/types";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  toolbar: ReactNode;
  actions: ReactNode;
  backHref?: string;
  backLabel?: string;
  deliveryMode?: SaleDeliveryMode;
  catalogLotRefs?: Array<{ id: string; lotNumber: number | null; title: string }>;
  saleroomSession?: PublicSaleroomSessionStatus | null;
  explainerContext?: SaleFormatExplainerContext;
};

export function SaleroomHero(props: Props) {
  return <SaleroomHeroAdaptive {...props} />;
}
