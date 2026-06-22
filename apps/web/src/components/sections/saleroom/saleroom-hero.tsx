import { SaleroomHeroEditorial } from "@/components/sections/saleroom/hero/saleroom-hero-editorial";
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
  coverBlurDataURL?: string | null;
  saleStartsSoon?: boolean;
  showOnlineBiddingGatedBadge?: boolean;
  explainerContext?: SaleFormatExplainerContext;
};

export function SaleroomHero(props: Props) {
  return <SaleroomHeroEditorial {...props} />;
}
