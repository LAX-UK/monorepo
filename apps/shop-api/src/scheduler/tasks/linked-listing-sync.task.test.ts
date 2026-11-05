import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.fn();
vi.mock("../../infrastructure/scheduler/linked-listing-sync.runner.js", () => ({
  createLinkedListingSyncRunner: () => sync,
}));

const { createLinkedListingSyncTask } = await import("./linked-listing-sync.task.js");

const NOW = new Date("2026-11-05T10:00:00.000Z");

function artCache() {
  return { invalidateEditorial: vi.fn(), invalidateCatalogue: vi.fn(async () => undefined) };
}

describe("linked listing sync task", () => {
  beforeEach(() => sync.mockReset());

  it("leaves lax.art alone when nothing moved", async () => {
    sync.mockResolvedValue({ details: 0, images: 0 });
    const cache = artCache();
    await createLinkedListingSyncTask({} as never, cache, vi.fn()).run(NOW);
    expect(cache.invalidateCatalogue).not.toHaveBeenCalled();
  });

  it("tells lax.art to refresh its artworks when a listing took Zoho's values", async () => {
    sync.mockResolvedValue({ details: 1, images: 0 });
    const cache = artCache();
    await createLinkedListingSyncTask({} as never, cache, vi.fn()).run(NOW);
    expect(cache.invalidateCatalogue).toHaveBeenCalledWith("artworks");
  });

  it("does not fail the pass when lax.art cannot be told", async () => {
    sync.mockResolvedValue({ details: 0, images: 2 });
    const cache = artCache();
    const failure = new Error("lax.art unreachable");
    cache.invalidateCatalogue.mockRejectedValue(failure);
    const onError = vi.fn();
    await expect(createLinkedListingSyncTask({} as never, cache, onError).run(NOW)).resolves.toBe(
      undefined,
    );
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
