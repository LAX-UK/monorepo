// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { useUnsavedChangesGuard, useUnsavedNavigationGuard } = await import(
  "./use-unsaved-changes-guard"
);

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

describe("useUnsavedNavigationGuard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    push.mockReset();
  });

  function link(href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
    const anchor = document.createElement("a");
    anchor.href = href;
    for (const [name, value] of Object.entries(attributes)) anchor.setAttribute(name, value);
    document.body.append(anchor);
    return anchor;
  }

  it("holds a click on an in-app link while dirty, then follows it once confirmed", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    const anchor = link("/editorial/exhibitions?q=a#top");
    const notPrevented = fireEvent.click(anchor);
    expect(notPrevented).toBe(false);
    expect(result.current.pendingHref).toBe("/editorial/exhibitions?q=a#top");
    expect(push).not.toHaveBeenCalled();

    act(() => result.current.leave());
    expect(push).toHaveBeenCalledWith("/editorial/exhibitions?q=a#top");
    expect(result.current.pendingHref).toBeNull();
  });

  it("drops the held link when the editor chooses to stay", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    fireEvent.click(link("/orders"));
    act(() => result.current.stay());
    expect(result.current.pendingHref).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("lets clicks through when nothing is dirty", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(false));
    const anchor = link("/orders");
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor);
    expect(result.current.pendingHref).toBeNull();
  });

  it.each([
    ["opens in a new tab", "/orders", { target: "_blank" }],
    ["is another site", "https://example.com/x", {}],
    ["stays on this page", window.location.pathname, {}],
  ])("ignores a link that %s", (_name, href, attributes) => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    const anchor = link(href, attributes);
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor);
    expect(result.current.pendingHref).toBeNull();
  });

  it("ignores modified clicks, which open elsewhere", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    const anchor = link("/orders");
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor, { metaKey: true });
    expect(result.current.pendingHref).toBeNull();
  });
});
