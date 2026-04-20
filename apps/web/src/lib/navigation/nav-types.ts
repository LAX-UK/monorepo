import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export type NavItemsProvider = {
  getItems(): readonly NavItem[];
};
