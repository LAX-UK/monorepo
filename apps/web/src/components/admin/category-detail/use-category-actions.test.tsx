import {
  categoryUsageSummary,
  useCategoryActions,
} from "@/components/admin/category-detail/use-category-actions";
import type { AdminCategory } from "@auction/types";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/admin", () => ({
  adminArchiveCategoryResultAction: vi.fn(),
  adminDeleteCategoryResultAction: vi.fn(),
  adminUpdateCategoryResultAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const base: AdminCategory = {
  id: "c1",
  name: "Paintings",
  slug: "paintings",
  description: null,
  archived: false,
  sortOrder: 0,
  parentId: null,
  heroImageKey: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  usage: { lots: 0, sales: 0, submissions: 0, interests: 0, total: 0 },
};

describe("categoryUsageSummary", () => {
  it("names what still uses the category, in words", () => {
    expect(
      categoryUsageSummary({ lots: 3, sales: 1, submissions: 2, interests: 0, total: 6 }),
    ).toBe("3 lots, 1 sale and 2 submissions");
    expect(
      categoryUsageSummary({ lots: 0, sales: 0, submissions: 0, interests: 2, total: 2 }),
    ).toBe("2 buyer interests");
  });
});

describe("useCategoryActions", () => {
  it("offers archive and an enabled delete for an unused category", () => {
    const { result } = renderHook(() => useCategoryActions(base));
    const ids = result.current.items.map((item) => item.id);
    expect(ids).toEqual(["archive", "delete"]);
    expect(result.current.items[1]?.disabledReason).toBeUndefined();
    expect(result.current.items[1]?.tone).toBe("danger");
  });

  it("explains why a category in use cannot be deleted", () => {
    const { result } = renderHook(() =>
      useCategoryActions({
        ...base,
        usage: { lots: 1, sales: 0, submissions: 0, interests: 2, total: 3 },
      }),
    );
    expect(result.current.items[1]?.disabledReason).toBe(
      "Still used by 1 lot and 2 buyer interests. Archive it instead.",
    );
  });

  it("offers restore, not archive, for an archived category", () => {
    const { result } = renderHook(() => useCategoryActions({ ...base, archived: true }));
    expect(result.current.items.map((item) => item.id)).toEqual(["restore", "delete"]);
  });
});
