import { act, cleanup, fireEvent, renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("holds a click on an in-app link while dirty, then follows it once confirmed", async () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    const anchor = link("/editorial/exhibitions?q=a#top");
    const notPrevented = fireEvent.click(anchor);
    expect(notPrevented).toBe(false);
    expect(result.current.pending).toBe(true);
    expect(push).not.toHaveBeenCalled();

    act(() => result.current.leave());
    // The extra history entry is stepped off first, then the destination is followed.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/editorial/exhibitions?q=a#top"));
    expect(result.current.pending).toBe(false);
  });

  it("drops the held link when the editor chooses to stay", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    fireEvent.click(link("/orders"));
    act(() => result.current.stay());
    expect(result.current.pending).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("lets clicks through when nothing is dirty", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(false));
    const anchor = link("/orders");
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor);
    expect(result.current.pending).toBe(false);
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
    expect(result.current.pending).toBe(false);
  });

  it("ignores modified clicks, which open elsewhere", () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    const anchor = link("/orders");
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor, { metaKey: true });
    expect(result.current.pending).toBe(false);
  });
});

describe("useUnsavedNavigationGuard with the browser Back button", () => {
  const entries = () => (window.history.state as Record<string, unknown> | null) ?? {};
  const sentinelOnTop = () => "__unsavedChangesGuard" in entries();

  async function pressBack(): Promise<void> {
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  async function drainSentinels(): Promise<void> {
    // Return to the first entry whatever an earlier test left behind.
    while (sentinelOnTop()) await pressBack();
  }

  beforeEach(async () => {
    cleanup();
    await drainSentinels();
  });

  afterEach(async () => {
    cleanup();
    push.mockReset();
    vi.restoreAllMocks();
    await drainSentinels();
  });

  it("pushes one entry while dirty and none when clean", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedNavigationGuard(false));
    expect(pushState).not.toHaveBeenCalled();
    renderHook(() => useUnsavedNavigationGuard(true));
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(sentinelOnTop()).toBe(true);
  });

  it("does not stack a second entry when Strict Mode mounts twice", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedNavigationGuard(true), { wrapper: StrictMode });
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("turns Back into a confirmation and keeps the page when the user stays", async () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    await pressBack();
    expect(result.current.pending).toBe(true);
    expect(sentinelOnTop()).toBe(false);

    act(() => result.current.stay());
    expect(result.current.pending).toBe(false);
    expect(sentinelOnTop()).toBe(true);
  });

  it("goes back for real once the user confirms leaving", async () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    await pressBack();
    const back = vi.spyOn(window.history, "back");
    act(() => result.current.leave());
    expect(back).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it("release removes the entry and resolves only once the browser has settled", async () => {
    const { result } = renderHook(() => useUnsavedNavigationGuard(true));
    expect(sentinelOnTop()).toBe(true);
    await act(async () => {
      await result.current.release();
    });
    expect(sentinelOnTop()).toBe(false);
    expect(result.current.pending).toBe(false);
    // Nothing is left to release the second time.
    await act(async () => {
      await result.current.release();
    });
  });

  it("removes its entry when the page becomes clean, so Back is not intercepted", async () => {
    const { result, rerender } = renderHook(({ dirty }) => useUnsavedNavigationGuard(dirty), {
      initialProps: { dirty: true },
    });
    rerender({ dirty: false });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(sentinelOnTop()).toBe(false);
    await pressBack();
    expect(result.current.pending).toBe(false);
  });
});
