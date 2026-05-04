import { describe, expect, it, vi } from "vitest";
import { ImageCleanupService } from "./image-cleanup.service.js";
import type { IObjectStorage } from "./interfaces/object-storage.js";

function storage(): IObjectStorage {
  return {
    putObject: vi.fn(),
    getPublicUrl: vi.fn(),
    createPresignedPut: vi.fn(),
    createPresignedGet: vi.fn(),
    extractKey: vi.fn((value: string) => {
      if (value.startsWith("https://cdn.example.com/")) {
        return value.slice("https://cdn.example.com/".length);
      }
      if (!value.startsWith("http")) return value;
      return null;
    }),
    headObject: vi.fn(),
    getObjectBytes: vi.fn(),
    deleteObject: vi.fn(),
  };
}

describe("ImageCleanupService", () => {
  it("enqueues removed owned keys", async () => {
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new ImageCleanupService(storage(), queue as never);

    await service.enqueueRemovedMany(
      ["uploads/pending/lots/u/old.webp", "https://foreign.example.com/image.webp"],
      ["uploads/pending/lots/u/new.webp"],
    );

    expect(queue.add).toHaveBeenCalledWith(
      "delete-image",
      { key: "uploads/pending/lots/u/old.webp" },
      { attempts: 3 },
    );
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue when the extracted key is still present", async () => {
    const queue = { add: vi.fn() };
    const service = new ImageCleanupService(storage(), queue as never);

    await service.enqueueRemoved(
      "https://cdn.example.com/uploads/pending/avatar/u/1.webp",
      "uploads/pending/avatar/u/1.webp",
    );

    expect(queue.add).not.toHaveBeenCalled();
  });
});
