import { SaleroomHeroAdaptive } from "@/components/sections/saleroom/saleroom-hero-adaptive";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleDeliveryMode } from "@auction/types";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  toolbar: ReactNode;
  actions: ReactNode;
  isAuthenticated?: boolean;
  backHref?: string;
  backLabel?: string;
  deliveryMode?: SaleDeliveryMode;
  streamUrl?: string | null;
  catalogLotRefs?: Array<{ id: string; lotNumber: number | null; title: string }>;
  saleroomSession?: PublicSaleroomSessionStatus | null;
};

export function SaleroomHero(props: Props) {
  return <SaleroomHeroAdaptive {...props} />;
}
