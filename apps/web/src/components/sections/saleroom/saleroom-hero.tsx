import { SaleroomHeroAdaptive } from "@/components/sections/saleroom/saleroom-hero-adaptive";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  toolbar: ReactNode;
  actions: ReactNode;
  isAuthenticated?: boolean;
  backHref?: string;
  backLabel?: string;
  deliveryMode?: "online" | "onsite";
  streamUrl?: string | null;
};

export function SaleroomHero(props: Props) {
  return <SaleroomHeroAdaptive {...props} />;
}
