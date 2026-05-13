import type { CapabilityRequirement } from "@auction/types";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** When set, item is shown only if {@link userHasAccessTo} passes for the session user. */
  requirement?: CapabilityRequirement;
};

export type NavGroup = {
  title: string;
  items: readonly NavItem[];
};

export type NavItemsProvider = {
  getItems(): readonly NavItem[];
};
