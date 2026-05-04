import type { Queue } from "bullmq";
import type { IObjectStorage } from "./interfaces/object-storage.js";

type ImageCleanupJob = {
  key: string;
};

export class ImageCleanupService {
  constructor(
    private readonly storage: IObjectStorage,
    private readonly queue: Queue<ImageCleanupJob>,
  ) {}

  async enqueueRemoved(previous: string | null | undefined, next: string | null | undefined) {
    if (!previous || previous === next) return;
    const previousKey = this.storage.extractKey(previous);
    if (!previousKey) return;
    const nextKey = next ? this.storage.extractKey(next) : null;
    if (previousKey === nextKey) return;
    await this.queue.add("delete-image", { key: previousKey }, { attempts: 3 });
  }

  async enqueueRemovedMany(previous: readonly string[], next: readonly string[]) {
    const nextKeys = new Set(next.map((value) => this.storage.extractKey(value)).filter(Boolean));
    for (const value of previous) {
      const key = this.storage.extractKey(value);
      if (!key || nextKeys.has(key)) continue;
      await this.queue.add("delete-image", { key }, { attempts: 3 });
    }
  }
}
