import { describe, expect, it, vi } from "vitest";
import { FakeArchiveStore } from "./fake-export-world.test-util.js";
import { purgeSubjectExportObjects } from "./purge-subject-export-objects.js";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const log = { info: vi.fn(), warn: vi.fn() };

function ledger(items: { exportId: string; objectKey: string }[]) {
  return {
    pending: vi.fn().mockResolvedValue(items),
    confirmPurged: vi.fn().mockResolvedValue(undefined),
  };
}

describe("purging stored copies", () => {
  it("deletes each object, then tells Identity it is gone", async () => {
    const store = new FakeArchiveStore();
    const port = ledger([
      { exportId: A, objectKey: `subject-exports/${A}/lax-data-2026-11-02.zip` },
      { exportId: B, objectKey: `subject-exports/${B}/lax-data-2026-11-03.zip` },
    ]);
    await expect(purgeSubjectExportObjects({ ledger: port, store, log })).resolves.toEqual({
      purged: 2,
      failed: 0,
    });
    expect(store.deleted).toEqual([
      `subject-exports/${A}/lax-data-2026-11-02.zip`,
      `subject-exports/${B}/lax-data-2026-11-03.zip`,
    ]);
    expect(port.confirmPurged.mock.calls.map(([id]) => id)).toEqual([A, B]);
  });

  it("does nothing when nothing is pending", async () => {
    const store = new FakeArchiveStore();
    const port = ledger([]);
    await purgeSubjectExportObjects({ ledger: port, store, log });
    expect(store.deleted).toEqual([]);
    expect(port.confirmPurged).not.toHaveBeenCalled();
  });

  it("keeps a copy pending when its delete fails, and carries on with the rest", async () => {
    const store = new FakeArchiveStore();
    const failing = `subject-exports/${A}/lax-data-2026-11-02.zip`;
    store.failDelete.add(failing);
    const port = ledger([
      { exportId: A, objectKey: failing },
      { exportId: B, objectKey: `subject-exports/${B}/lax-data-2026-11-03.zip` },
    ]);
    await expect(purgeSubjectExportObjects({ ledger: port, store, log })).resolves.toEqual({
      purged: 1,
      failed: 1,
    });
    expect(port.confirmPurged.mock.calls.map(([id]) => id)).toEqual([B]);
  });

  it("refuses a key outside the request's own folder", async () => {
    const store = new FakeArchiveStore();
    const port = ledger([
      { exportId: A, objectKey: `subject-exports/${B}/lax-data-2026-11-03.zip` },
      { exportId: A, objectKey: "media/artwork/a.jpg" },
    ]);
    await expect(purgeSubjectExportObjects({ ledger: port, store, log })).resolves.toEqual({
      purged: 0,
      failed: 2,
    });
    expect(store.deleted).toEqual([]);
    expect(port.confirmPurged).not.toHaveBeenCalled();
  });
});
