import type { ExportPhase } from "@auction/exports";
import type { Redis } from "ioredis";
import { type ExportProgressSnapshot, progressKey } from "./export-types.js";

const EXPORT_PROGRESS_TTL_SEC = 3600;

export interface IExportProgressStore {
  set(exportId: string, snapshot: ExportProgressSnapshot): Promise<void>;
  read(exportId: string): Promise<{
    phase?: ExportPhase;
    processedRows?: number;
    totalRows?: number;
  }>;
}

export class RedisExportProgressStore implements IExportProgressStore {
  constructor(private readonly redis: Redis) {}

  async set(exportId: string, snapshot: ExportProgressSnapshot): Promise<void> {
    await this.redis.set(
      progressKey(exportId),
      JSON.stringify(snapshot),
      "EX",
      EXPORT_PROGRESS_TTL_SEC,
    );
  }

  async read(exportId: string) {
    const cached = await this.redis.get(progressKey(exportId));
    return cached
      ? (JSON.parse(cached) as {
          phase?: ExportPhase;
          processedRows?: number;
          totalRows?: number;
        })
      : {};
  }
}

export { EXPORT_PROGRESS_TTL_SEC };
