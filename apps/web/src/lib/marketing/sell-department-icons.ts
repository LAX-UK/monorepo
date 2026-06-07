import {
  BookOpen,
  Building2,
  Car,
  Coins,
  Gem,
  Image,
  Layers,
  type LucideIcon,
  Palette,
  Printer,
  Shapes,
  Watch,
} from "lucide-react";

export const SELL_DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  paintings: Palette,
  sculpture: Shapes,
  photography: Image,
  "digital-art": Layers,
  "mixed-media": Layers,
  drawings: BookOpen,
  "watches-clocks": Watch,
  "motor-cars": Car,
  "coins-medals": Coins,
  "design-decorative-arts": Gem,
  "fine-prints": Printer,
  "books-manuscripts": BookOpen,
  jewellery: Gem,
  "handbags-accessories": Gem,
  estate: Building2,
  corporate: Building2,
};

export function sellDepartmentIcon(id: string): LucideIcon {
  return SELL_DEPARTMENT_ICONS[id] ?? Layers;
}
