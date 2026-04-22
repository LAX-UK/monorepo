import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export type NavGroup = {
  title: string;
  items: readonly NavItem[];
};

export type NavItemsProvider = {
  getItems(): readonly NavItem[];
};
