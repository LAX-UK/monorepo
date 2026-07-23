export type CatalogHttpJson = { status: number; body: unknown };

export type CatalogViewerContext = {
  userId?: string | null | undefined;
  role?: string | null | undefined;
  staffRole?: string | null | undefined;
};
