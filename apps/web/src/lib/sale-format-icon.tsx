import type { SaleFormatExplainerViewModel } from "@/lib/sale-format-explainer";
import type { SaleTypePresentation } from "@/lib/sale-type-presentation";
import { Laptop, type LucideIcon, MapPin } from "lucide-react";

type IconName = SaleTypePresentation["iconName"] | SaleFormatExplainerViewModel["iconName"];

export function saleFormatIcon(iconName: IconName): LucideIcon {
  return iconName === "Laptop" ? Laptop : MapPin;
}

export function saleFormatIconToneClass(mode: SaleFormatExplainerViewModel["mode"]): string {
  return mode === "onsite"
    ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
    : "bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400";
}
