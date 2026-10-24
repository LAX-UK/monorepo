import type { LucideIcon } from "lucide-react";

export type StaffNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Records waiting for this person, beside the label. */
  count?: number;
  /** "attention" fills the count in ink: something needs doing, not just exists. */
  countTone?: "neutral" | "attention";
  /** Overrides the default longest-prefix match, for items that own unrelated paths. */
  match?: (pathname: string) => boolean;
  /** Extra words ⌘K should match, e.g. "people" for Staff. */
  keywords?: readonly string[];
};

export type StaffNavGroup = {
  id: string;
  /** Sentence case. Omit for the ungrouped top block (e.g. Overview). */
  title?: string;
  items: readonly StaffNavItem[];
};

/** One staff tool a person can switch to. Only list tools the person can open. */
export type StaffProduct = {
  id: "lax-admin" | "bid-admin";
  name: string;
  /** What it manages, under the name in the switcher. */
  description: string;
  href: string;
};

export type StaffUser = {
  name: string;
  email?: string;
  /** "Super admin", "Finance", "Catalogue manager"… */
  roleLabel: string;
};

export type StaffTheme = "light" | "dark" | "system";

export type StaffBreadcrumb = { label: string; href?: string };

export type StaffCommand = {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  /** Text after the label: an email, a status, a shortcut. */
  hint?: string;
  keywords?: readonly string[];
  href?: string;
  onSelect?: () => void;
};

/** Live search results for ⌘K, e.g. orders or people matching the query. */
export type StaffCommandSearch = (query: string) => Promise<readonly StaffCommand[]>;
