import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMediaCollectionUi } from "./use-media-collection-ui";

describe("useMediaCollectionUi", () => {
  it("toggles add and manage modes and closes inspector when manage closes", () => {
    let inspectTarget: string | null = null;
    const setInspectTarget = (next: string | null) => {
      inspectTarget = next;
    };

    const { result, rerender } = renderHook(
      ({ length }) =>
        useMediaCollectionUi({
          collectionLength: length,
          inspectTarget,
          setInspectTarget,
        }),
      { initialProps: { length: 0 } },
    );

    act(() => result.current.toggleAdd());
    expect(result.current.showAdd).toBe(true);

    act(() => {
      inspectTarget = "item-1";
      result.current.toggleManage();
    });
    rerender({ length: 0 });
    expect(result.current.showManage).toBe(true);

    act(() => result.current.toggleManage());
    expect(inspectTarget).toBeNull();
  });

  it("auto-closes add panel when collection length increases", () => {
    let inspectTarget: number | null = null;
    const { result, rerender } = renderHook(
      ({ length }) =>
        useMediaCollectionUi({
          collectionLength: length,
          inspectTarget,
          setInspectTarget: (next) => {
            inspectTarget = next;
          },
        }),
      { initialProps: { length: 0 } },
    );

    act(() => result.current.setShowAdd(true));
    rerender({ length: 1 });
    expect(result.current.showAdd).toBe(false);
  });

  it("returns focus to the manage trigger when manage mode closes", async () => {
    let inspectTarget: string | null = null;
    const { result } = renderHook(() =>
      useMediaCollectionUi({
        collectionLength: 1,
        inspectTarget,
        setInspectTarget: (next) => {
          inspectTarget = next;
        },
      }),
    );
    const button = document.createElement("button");
    document.body.append(button);
    result.current.manageButtonRef.current = button;

    act(() => result.current.toggleManage());
    await act(async () => {
      result.current.toggleManage();
      await Promise.resolve();
    });

    expect(button).toHaveFocus();
    button.remove();
  });
});
