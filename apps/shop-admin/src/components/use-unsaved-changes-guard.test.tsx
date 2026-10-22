// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

function fireBeforeUnload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

describe("useUnsavedChangesGuard", () => {
  it("blocks leaving the page while there are unsaved changes", () => {
    renderHook(() => useUnsavedChangesGuard(true));
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it("lets the page close when nothing is dirty", () => {
    renderHook(() => useUnsavedChangesGuard(false));
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("stops guarding once the editor is saved or unmounted", () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });
    rerender({ dirty: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    rerender({ dirty: true });
    unmount();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
