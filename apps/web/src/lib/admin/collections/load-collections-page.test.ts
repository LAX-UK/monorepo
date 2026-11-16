import { STORAGE, STORAGE_VENUE } from "@/lib/admin/collections/storage.fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  venues: vi.fn(),
  settings: vi.fn(),
  storage: vi.fn(),
  day: vi.fn(),
  list: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-collections.reader", () => ({
  getCollectionVenues: mocks.venues,
  getCollectionSettings: mocks.settings,
}));
vi.mock("@/lib/data/http/admin-collection-storage.reader", () => ({
  getCollectionStorage: mocks.storage,
}));
vi.mock("@/lib/data/http/admin-collection-desk.reader", () => ({
  getDeskDay: mocks.day,
  getDeskList: mocks.list,
}));

const { loadCollectionsPage } = await import("./load-collections-page");

const FINANCE = { settings: false, storage: true };
const TODAY = "2026-11-15";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.venues.mockResolvedValue([{ venueId: STORAGE_VENUE, name: "LAX Gallery" }]);
  mocks.storage.mockResolvedValue(STORAGE);
});

describe("loadCollectionsPage for Finance", () => {
  it("opens on Storage and never asks for the hours, rules or visits", async () => {
    const page = await loadCollectionsPage({ tab: "day" }, TODAY, FINANCE);
    expect(page).toMatchObject({
      tab: "storage",
      venueId: STORAGE_VENUE,
      settings: null,
      desk: null,
      storage: { settings: STORAGE, error: null },
      loadError: null,
    });
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.day).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.storage).toHaveBeenCalledWith(STORAGE_VENUE);
  });

  it("keeps the page and says the storage terms did not load, so the tab can retry", async () => {
    mocks.storage.mockRejectedValue(new Error("down"));
    const page = await loadCollectionsPage({ tab: "storage" }, TODAY, FINANCE);
    expect(page.loadError).toBeNull();
    expect(page.storage).toEqual({
      settings: null,
      error: "We couldn't load the storage terms. Try again in a moment.",
    });
  });

  it("says the page did not load when the places cannot be read", async () => {
    mocks.venues.mockRejectedValue(new Error("down"));
    const page = await loadCollectionsPage({ tab: "storage" }, TODAY, FINANCE);
    expect(page.loadError).toBe("We couldn't load the collection settings. Try again in a moment.");
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("loads nothing for Storage when there is no place to collect from", async () => {
    mocks.venues.mockResolvedValue([]);
    const page = await loadCollectionsPage({ tab: "storage" }, TODAY, FINANCE);
    expect(page).toMatchObject({ venueId: null, storage: null, loadError: null });
    expect(mocks.storage).not.toHaveBeenCalled();
  });
});
