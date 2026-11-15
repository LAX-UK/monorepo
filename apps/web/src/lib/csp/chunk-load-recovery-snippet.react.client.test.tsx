import { CHUNK_LOAD_RECOVERY_SNIPPET } from "@/lib/csp/chunk-load-recovery-snippet.client";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Controlled() {
  const [value, setValue] = useState("");
  return <input aria-label="Bid limit" value={value} onChange={(e) => setValue(e.target.value)} />;
}

const reload = vi.fn();
const added: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];

/** Runs the snippet against the jsdom window, remembering its listeners so each test starts clean. */
function installSnippet() {
  for (const target of [window, document]) {
    const original = target.addEventListener.bind(target) as (...args: unknown[]) => void;
    vi.spyOn(target, "addEventListener").mockImplementation(((...args: unknown[]) => {
      added.push([
        target,
        args[0] as string,
        args[1] as EventListenerOrEventListenerObject,
        args[2],
      ]);
      original(...args);
    }) as never);
  }
  new Function("window", "document", "navigator", "fetch", CHUNK_LOAD_RECOVERY_SNIPPET)(
    window,
    document,
    { onLine: true },
    fetch,
  );
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let originalLocation: Location;

beforeEach(() => {
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      reload,
      assign: vi.fn(),
      href: "http://localhost/admin",
      origin: "http://localhost",
      pathname: "/admin",
      search: "",
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ status: 404 })),
  );
  window.sessionStorage.clear();
  reload.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  for (const [target, type, fn, options] of added.splice(0)) {
    target.removeEventListener(type, fn, options as never);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function markStaleThenHide() {
  // The snippet registers listeners on the real jsdom window for each run; use a fresh copy.
  const script = document.createElement("script");
  script.src = "/_next/static/chunks/app/lot-1a2b3c.js";
  document.head.append(script);
  script.dispatchEvent(new Event("error"));
  script.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("recovery snippet with React 19 fields", () => {
  it("sees that a controlled input keeps value equal to defaultValue", async () => {
    await act(async () => root.render(<Controlled />));
    const input = container.querySelector("input") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "250");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("250");
    expect(input.defaultValue).toBe("250");
  });

  it("does not reload after typing into a controlled field that has lost focus", async () => {
    installSnippet();
    await act(async () => root.render(<Controlled />));
    const input = container.querySelector("input") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "250");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.blur();
    expect(document.activeElement).not.toBe(input);
    await markStaleThenHide();
    expect(reload).not.toHaveBeenCalled();
  });

  it("forgets an edit once the page path has changed", async () => {
    installSnippet();
    await act(async () => root.render(<Controlled />));
    const input = container.querySelector("input") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "250");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.blur();
    (window.location as { pathname: string }).pathname = "/admin/other";
    await markStaleThenHide();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads when nothing has been typed", async () => {
    installSnippet();
    await act(async () => root.render(<Controlled />));
    await markStaleThenHide();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
