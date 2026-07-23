/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ADMIN_PEOPLE_LIST_HEADING_ID,
  useAdminListPreviewReturnFocus,
} from "./use-admin-list-preview-return-focus";

describe("useAdminListPreviewReturnFocus", () => {
  it("restores focus to the captured trigger", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();

    const { result } = renderHook(() => useAdminListPreviewReturnFocus());
    act(() => {
      result.current.captureReturnFocus(button);
    });

    const other = document.createElement("button");
    document.body.append(other);
    other.focus();

    act(() => {
      result.current.restoreReturnFocus();
    });

    expect(document.activeElement).toBe(button);
  });

  it("falls back to the list heading when no trigger was captured", () => {
    const heading = document.createElement("h1");
    heading.id = ADMIN_PEOPLE_LIST_HEADING_ID;
    document.body.append(heading);

    const { result } = renderHook(() => useAdminListPreviewReturnFocus());
    act(() => {
      result.current.restoreReturnFocus();
    });

    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });
});
