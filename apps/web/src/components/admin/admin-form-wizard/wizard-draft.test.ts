import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWizardDraft,
  mergeWizardDraftValues,
  readWizardDraft,
  wizardDraftCookieKey,
  writeWizardDraft,
} from "./wizard-draft";

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
}

const memoryLocalStorage = createMemoryLocalStorage();

describe("wizard-draft", () => {
  const key = wizardDraftCookieKey("lot", "new");

  beforeAll(() => {
    vi.stubGlobal("localStorage", memoryLocalStorage);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    memoryLocalStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    memoryLocalStorage.clear();
  });

  it("round-trips draft payload through localStorage", () => {
    const payload = {
      stepIndex: 2,
      values: { title: "Test lot", auctionType: "english" },
      savedAt: new Date().toISOString(),
    };
    writeWizardDraft(key, payload);
    expect(readWizardDraft(key)).toEqual(payload);
  });

  it("returns null for missing or invalid drafts", () => {
    expect(readWizardDraft(key)).toBeNull();
    localStorage.setItem(key, "not-json");
    expect(readWizardDraft(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify({ stepIndex: "bad" }));
    expect(readWizardDraft(key)).toBeNull();
  });

  it("expires drafts older than TTL", () => {
    writeWizardDraft(key, {
      stepIndex: 1,
      values: { title: "Old" },
      savedAt: new Date("2026-05-01T12:00:00.000Z").toISOString(),
    });
    expect(readWizardDraft(key)).toBeNull();
    expect(memoryLocalStorage.getItem(key)).toBeNull();
  });

  it("clearWizardDraft removes stored payload", () => {
    writeWizardDraft(key, {
      stepIndex: 0,
      values: {},
      savedAt: new Date().toISOString(),
    });
    clearWizardDraft(key);
    expect(readWizardDraft(key)).toBeNull();
  });
});

describe("mergeWizardDraftValues", () => {
  it("overlays draft values onto baseline defaults", () => {
    const baseline = {
      title: "",
      description: "",
      auctionType: "english" as const,
      startingPrice: "0.00",
    };
    const merged = mergeWizardDraftValues(baseline, {
      title: "Saved title",
      startingPrice: "150.00",
    });
    expect(merged).toEqual({
      title: "Saved title",
      description: "",
      auctionType: "english",
      startingPrice: "150.00",
    });
  });

  it("preserves baseline fields omitted from partial draft", () => {
    const baseline = {
      title: "",
      categoryIds: [] as string[],
      images: [] as string[],
    };
    const merged = mergeWizardDraftValues(baseline, { title: "Only title saved" });
    expect(merged.title).toBe("Only title saved");
    expect(merged.categoryIds).toEqual([]);
    expect(merged.images).toEqual([]);
  });
});
