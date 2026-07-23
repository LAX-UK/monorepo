import { submissionsFilterAdapter } from "@/lib/admin/filters/submissions-filter-adapter";
import { useAdminFilterDraft } from "@/lib/admin/filters/use-admin-filter-draft";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/submissions",
  useSearchParams: () => new URLSearchParams("queue=pending&offset=20"),
}));

describe("useAdminFilterDraft", () => {
  it("applies staged changes with offset reset and preserved lens params", () => {
    push.mockClear();

    const { result } = renderHook(() =>
      useAdminFilterDraft({
        adapter: submissionsFilterAdapter,
        preserved: { queue: "pending" },
        open: true,
      }),
    );

    act(() => {
      result.current.patch({ assignedToMe: true, sortBySla: true, qualityGaps: true });
    });

    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.apply();
    });

    expect(push).toHaveBeenCalledTimes(1);
    const href = push.mock.calls[0]?.[0] as string;
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("assignedTo")).toBe("me");
    expect(params.get("sort")).toBe("sla");
    expect(params.get("qualityGaps")).toBe("1");
    expect(params.get("queue")).toBe("pending");
    expect(params.get("offset")).toBe("0");
  });

  it("reset restores adapter defaults", () => {
    const { result } = renderHook(() =>
      useAdminFilterDraft({
        adapter: submissionsFilterAdapter,
        preserved: { queue: "pending" },
        open: true,
      }),
    );

    act(() => {
      result.current.patch({ assignedToMe: true });
      result.current.reset();
    });

    expect(result.current.draft.assignedToMe).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });
});
