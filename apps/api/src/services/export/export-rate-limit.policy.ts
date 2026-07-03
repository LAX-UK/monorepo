import { AuthzError } from "@auction/exports/providers";
import type { IExportJobRepository } from "../../repositories/interfaces/export-job.repository.js";
import { utcDayStart } from "./export-types.js";

const MAX_CONCURRENT_EXPORTS = 5;
const MAX_DAILY_EXPORTS = 20;

export class ExportRateLimitPolicy {
  constructor(
    private readonly repo: IExportJobRepository,
    private readonly staleProcessingMs: number,
  ) {}

  async assertWithinLimits(userId: string): Promise<void> {
    const staleCutoff = new Date(Date.now() - this.staleProcessingMs);
    const active = await this.repo.countActiveSince(userId, staleCutoff);
    if (active >= MAX_CONCURRENT_EXPORTS) {
      throw new AuthzError("Too many exports running — try again in a few minutes", 429);
    }

    const daily = await this.repo.countSince(userId, utcDayStart());
    if (daily >= MAX_DAILY_EXPORTS) {
      throw new AuthzError("Daily export limit reached (20/day). Try again tomorrow.", 429);
    }
  }
}
