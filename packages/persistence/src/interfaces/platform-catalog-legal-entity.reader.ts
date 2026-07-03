export type PlatformCatalogLegalEntityIdProvider = () => Promise<string | null>;

export interface IPlatformCatalogLegalEntityReader {
  findUsableById(id: string): Promise<string | null>;
  findConfigured(configuredId: string): Promise<string | null>;
  findLaxManaged(): Promise<string | null>;
  findBySlug(slug: string): Promise<string | null>;
}
