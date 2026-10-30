import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  useDashboardListDensityClass,
  useDashboardListRowPaddingClass,
} from "./use-dashboard-list-density";

describe("list density", () => {
  it("keeps comfortable spacing in a frame without a shell config (the organisation workspace)", () => {
    expect(renderHook(() => useDashboardListDensityClass()).result.current).toBe("gap-3");
    expect(renderHook(() => useDashboardListRowPaddingClass()).result.current).toBe("py-4");
  });

  it("follows the frame's compact density when it has one", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ShellConfigProvider config={{ density: "compact" } as never}>{children}</ShellConfigProvider>
    );
    expect(renderHook(() => useDashboardListDensityClass(), { wrapper }).result.current).toBe(
      "gap-2",
    );
  });
});
