import type { ICacheProvider } from "./interfaces/cache.js";

export class CachedCatalogueListService {
  constructor(
    private readonly cache: ICacheProvider,
    private readonly ttlSec = 20,
  ) {}

  buildKey(route: "lots" | "sales", query: Record<string, unknown>): string {
    const normalized = Object.keys(query)
      .sort()
      .filter((key) => {
        const value = query[key];
        return value !== undefined && value !== null && value !== "";
      })
      .map((key) => `${key}=${String(query[key])}`)
      .join("&");
    return `catalogue:${route}:${normalized}`;
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.cache.get(key);
      if (cached != null) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Cache read/parse failure — fall through to loader.
    }

    const value = await load();
    try {
      await this.cache.set(key, JSON.stringify(value), this.ttlSec);
    } catch {
      // Cache write failure — still return fresh value.
    }
    return value;
  }
}
