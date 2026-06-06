import type { NavBadgeTone } from "@/lib/shell/contracts";
import type { LucideIcon } from "lucide-react";

export type PaletteItemKind = "page" | "record" | "action" | "recent" | "shortcut";

export type PaletteItem = {
  id: string;
  href: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon?: LucideIcon;
  badge?: number;
  badgeTone?: NavBadgeTone;
  kind?: PaletteItemKind;
};

export type PaletteSection = {
  id: string;
  heading: string;
  items: PaletteItem[];
};

export type PaletteSource = {
  id: string;
  heading: string;
  /** Static items when query is empty; async search when query has text. */
  search: (query: string) => Promise<PaletteItem[]>;
  enabled?: boolean;
};
