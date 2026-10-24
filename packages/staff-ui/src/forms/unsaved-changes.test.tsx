import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnsavedChangesGuard,
  confirmDiscardChanges,
  hasUnsavedChanges,
  useBeforeUnloadGuard,
  useUnsavedChanges,
} from "./unsaved-changes.js";

function fireBeforeUnload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

function link(href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = href;
  for (const [name, value] of Object.entries(attributes)) anchor.setAttribute(name, value);
  document.body.append(anchor);
  return anchor;
}

afterEach(() => {
  for (const anchor of document.querySelectorAll("body > a")) anchor.remove();
});

describe("useBeforeUnloadGuard", () => {
  it("asks the browser to confirm closing the tab only while there are changes", () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useBeforeUnloadGuard(dirty), {
      initialProps: { dirty: true },
    });
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    rerender({ dirty: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    rerender({ dirty: true });
    unmount();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});

describe("useUnsavedChanges with links", () => {
  const options = (navigate: (href: string) => void) => ({ navigate, interceptBack: false });

  it("holds a click on an in-app link while dirty, then follows it once confirmed", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(true, options(navigate)));
    expect(fireEvent.click(link("/editorial/exhibitions?q=a#top"))).toBe(false);
    expect(result.current.pending).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    act(() => result.current.leave());
    expect(navigate).toHaveBeenCalledWith("/editorial/exhibitions?q=a#top");
    expect(result.current.pending).toBe(false);
  });

  it("drops the held link when the person keeps editing", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(true, options(navigate)));
    fireEvent.click(link("/orders"));
    act(() => result.current.stay());
    expect(result.current.pending).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("lets clicks through when nothing is dirty", () => {
    const { result } = renderHook(() => useUnsavedChanges(false, options(vi.fn())));
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
    const { result } = renderHook(() => useUnsavedChanges(true, options(vi.fn())));
    const anchor = link(href, attributes);
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor);
    expect(result.current.pending).toBe(false);
  });

  it("ignores modified clicks, which open elsewhere", () => {
    const { result } = renderHook(() => useUnsavedChanges(true, options(vi.fn())));
    const anchor = link("/orders");
    anchor.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(anchor, { metaKey: true });
    expect(result.current.pending).toBe(false);
  });

  it("names what is being edited in the question", () => {
    const { result } = renderHook(() =>
      useUnsavedChanges(true, { label: "Water Lilies", interceptBack: false }),
    );
    expect(result.current.prompt.title).toBe("Discard changes to Water Lilies?");
  });
});

describe("confirmDiscardChanges", () => {
  it("resolves straight away when nothing is unsaved", async () => {
    expect(hasUnsavedChanges()).toBe(false);
    await expect(confirmDiscardChanges()).resolves.toBe(true);
  });

  it("asks the dirty form and resolves with the answer", async () => {
    const { result, unmount } = renderHook(() => useUnsavedChanges(true, { interceptBack: false }));
    expect(hasUnsavedChanges()).toBe(true);
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = confirmDiscardChanges({ title: "Switch section without saving?" });
    });
    expect(result.current.pending).toBe(true);
    expect(result.current.prompt.title).toBe("Switch section without saving?");
    act(() => result.current.stay());
    await expect(answer).resolves.toBe(false);

    act(() => {
      answer = confirmDiscardChanges();
    });
    act(() => result.current.leave());
    await expect(answer).resolves.toBe(true);
    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });
});

describe("UnsavedChangesGuard", () => {
  it("asks before a link leaves the page, with Keep editing focused first", async () => {
    const navigate = vi.fn();
    render(
      <UnsavedChangesGuard dirty label="Water Lilies" navigate={navigate} interceptBack={false} />,
    );
    fireEvent.click(link("/artworks"));
    const dialog = await screen.findByRole("dialog", { name: "Discard changes to Water Lilies?" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(navigate).toHaveBeenCalledWith("/artworks");
  });
});

describe("useUnsavedChanges with the browser Back button", () => {
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
    vi.restoreAllMocks();
    await drainSentinels();
  });

  it("pushes one entry while dirty and none when clean", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedChanges(false));
    expect(pushState).not.toHaveBeenCalled();
    renderHook(() => useUnsavedChanges(true));
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(sentinelOnTop()).toBe(true);
  });

  it("does not stack a second entry when Strict Mode mounts twice", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedChanges(true), { wrapper: StrictMode });
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("can leave the Back button alone", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedChanges(true, { interceptBack: false }));
    expect(pushState).not.toHaveBeenCalled();
  });

  it("turns Back into the question and keeps the page when the person stays", async () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    await pressBack();
    expect(result.current.pending).toBe(true);
    expect(sentinelOnTop()).toBe(false);
    act(() => result.current.stay());
    expect(result.current.pending).toBe(false);
    expect(sentinelOnTop()).toBe(true);
  });

  it("goes back for real once the person confirms leaving", async () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    await pressBack();
    const back = vi.spyOn(window.history, "back");
    act(() => result.current.leave());
    expect(back).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it("steps off its entry before following a held link", async () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(true, { navigate }));
    fireEvent.click(link("/orders"));
    act(() => result.current.leave());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/orders"));
  });

  it("release removes the entry and resolves only once the browser has settled", async () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    expect(sentinelOnTop()).toBe(true);
    await act(async () => {
      await result.current.release();
    });
    expect(sentinelOnTop()).toBe(false);
    await act(async () => {
      await result.current.release();
    });
  });

  it("removes its entry when the page becomes clean, so Back is not intercepted", async () => {
    const { result, rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
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
