import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export type NavGroup = {
  title: string;
  items: readonly NavItem[];
};

export type NavItemsProvider = {
  getItems(): readonly NavItem[];
};
