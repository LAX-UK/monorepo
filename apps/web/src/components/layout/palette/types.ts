export type PaletteItem = {
  id: string;
  href: string;
  label: string;
  hint?: string;
  keywords?: string;
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
