import { CHUNK_LOAD_RECOVERY_SNIPPET } from "@/lib/csp/chunk-load-recovery-snippet.client";
import { INLINE_HEAD_SCRIPTS } from "@/lib/csp/inline-head-scripts";
import {
  STALE_CHUNK_LEGACY_RELOAD_KEY,
  STALE_CHUNK_RELOAD_GUARD_MS,
  STALE_CHUNK_RELOAD_KEY,
} from "@/lib/socket-chunk-recovery.client";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: unknown) => void;
type Field = {
  tagName: string;
  type?: string;
  value?: string;
  defaultValue?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  options?: { selected: boolean; defaultSelected: boolean }[];
};

function run(
  input: {
    status?: number;
    online?: boolean;
    stored?: string | null;
    legacyStored?: string | null;
    fetchFails?: boolean;
    visibility?: "visible" | "hidden";
    overlay?: boolean;
    focused?: { tagName: string; isContentEditable?: boolean } | null;
    fields?: Field[];
  } = {},
) {
  const listeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const add = (into: Record<string, Listener[]>) => (name: string, fn: Listener) => {
    const list = into[name] ?? [];
    list.push(fn);
    into[name] = list;
  };
  const store = new Map<string, string>();
  if (input.stored) store.set(STALE_CHUNK_RELOAD_KEY, input.stored);
  if (input.legacyStored) store.set(STALE_CHUNK_LEGACY_RELOAD_KEY, input.legacyStored);
  const reload = vi.fn();
  const assign = vi.fn();
  const fetchMock = vi.fn(() =>
    input.fetchFails
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ status: input.status ?? 404 }),
  );
  const doc = {
    visibilityState: input.visibility ?? "visible",
    activeElement: input.focused ?? null,
    addEventListener: add(docListeners),
    querySelector: () => (input.overlay ? {} : null),
    querySelectorAll: () => input.fields ?? [],
  };
  const win = {
    addEventListener: add(listeners),
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    location: {
      reload,
      assign,
      href: "https://lax.test/lots/1",
      origin: "https://lax.test",
      pathname: "/lots/1",
      search: "",
    },
  };
  new Function("window", "document", "navigator", "fetch", CHUNK_LOAD_RECOVERY_SNIPPET)(
    win,
    doc,
    { onLine: input.online ?? true },
    fetchMock,
  );
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const fire = (name: string, event: unknown = {}) => {
    for (const fn of listeners[name] ?? []) fn(event);
  };
  const show = () => {
    doc.visibilityState = "visible";
    for (const fn of docListeners.visibilitychange ?? []) fn({});
  };
  const hide = () => {
    doc.visibilityState = "hidden";
    for (const fn of docListeners.visibilitychange ?? []) fn({});
  };
  return { fire, hide, show, doc, reload, assign, fetchMock, store, settle };
}

const link = (href: string, extra: Record<string, unknown> = {}) => ({
  button: 0,
  defaultPrevented: false,
  preventDefault: vi.fn(),
  stopImmediatePropagation: vi.fn(),
  target: {
    closest: () => ({ href, target: "", hasAttribute: () => false, ...extra }),
  },
});

const chunk = "/_next/static/chunks/app/lot-1a2b3c.js";
const scriptError = (src = chunk) => ({ target: { tagName: "SCRIPT", src } });

describe("site-wide chunk-load recovery", () => {
  it("is hashed into the CSP with the other inline head scripts", () => {
    expect(INLINE_HEAD_SCRIPTS).toContain(CHUNK_LOAD_RECOVERY_SNIPPET);
  });

  it("marks the page stale on a 404 but does not reload while the tab is in use", async () => {
    const { fire, reload, assign, fetchMock, settle } = run();
    fire("error", scriptError());
    await settle();
    expect(fetchMock).toHaveBeenCalledWith(chunk, { method: "HEAD", cache: "no-store" });
    expect(reload).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("reloads once when the tab becomes hidden after a build file has gone", async () => {
    const { fire, hide, reload, store, settle } = run({ status: 410 });
    fire("unhandledrejection", {
      reason: new Error(`Loading chunk 123 failed.\n(error: https://lax.test${chunk})`),
    });
    await settle();
    hide();
    hide();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.has(STALE_CHUNK_RELOAD_KEY)).toBe(true);
  });

  it("reloads straight away when the failure is confirmed in an already hidden tab", async () => {
    const { fire, reload, settle } = run({ visibility: "hidden" });
    fire("error", scriptError());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the tab is hidden but the build file is still there", async () => {
    const { fire, hide, reload, settle } = run({ status: 200 });
    fire("error", scriptError());
    await settle();
    hide();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload while a dialog is open, a request is in flight, or a field has focus", async () => {
    const cases = [
      { overlay: true },
      { focused: { tagName: "INPUT" } },
      { focused: { tagName: "DIV", isContentEditable: true } },
    ];
    for (const input of cases) {
      const { fire, hide, reload, settle } = run(input);
      fire("error", scriptError());
      await settle();
      hide();
      expect(reload).not.toHaveBeenCalled();
    }
  });

  it("does not reload while a form was just submitted", async () => {
    const { fire, hide, reload, settle } = run();
    fire("error", scriptError());
    await settle();
    fire("submit");
    hide();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload over unsaved input, and does once the page is clean", async () => {
    const fields: Field[] = [{ tagName: "INPUT", type: "text", value: "250", defaultValue: "" }];
    const { fire, hide, doc, reload, settle } = run({ fields });
    fire("error", scriptError());
    await settle();
    hide();
    expect(reload).not.toHaveBeenCalled();
    for (const field of fields) field.value = "";
    doc.visibilityState = "visible";
    hide();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the tab becomes visible again", async () => {
    const { fire, show, reload, settle } = run();
    fire("error", scriptError());
    await settle();
    show();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload over a checked box, a changed select, or a field edited by input", async () => {
    const cases: Field[] = [
      { tagName: "INPUT", type: "checkbox", checked: true, defaultChecked: false },
      {
        tagName: "SELECT",
        options: [
          { selected: false, defaultSelected: true },
          { selected: true, defaultSelected: false },
        ],
      },
    ];
    for (const field of cases) {
      const { fire, hide, reload, settle } = run({ fields: [field] });
      fire("error", scriptError());
      await settle();
      hide();
      expect(reload).not.toHaveBeenCalled();
    }
    // value equals defaultValue (a React controlled field) but an input event was seen
    const { fire, hide, reload, settle } = run({
      fields: [{ tagName: "INPUT", type: "text", value: "250", defaultValue: "250" }],
    });
    fire("input", { target: { tagName: "INPUT", type: "text" } });
    fire("error", scriptError());
    await settle();
    hide();
    expect(reload).not.toHaveBeenCalled();
  });

  it("ignores input events on non-editable targets, and a submit or reset clears the edit mark", async () => {
    for (const clear of ["submit", "reset"]) {
      const { fire, hide, show, reload, settle } = run();
      fire("change", { target: { tagName: "INPUT", type: "text" } });
      fire("error", scriptError());
      await settle();
      hide();
      expect(reload).not.toHaveBeenCalled();
      fire(clear);
      show();
      // the submit window still holds for 15 s; a reset leaves the page clean
      hide();
      expect(reload).toHaveBeenCalledTimes(clear === "reset" ? 1 : 0);
    }
    const { fire, hide, reload, settle } = run();
    fire("input", { target: { tagName: "DIV" } });
    fire("input", { target: { tagName: "INPUT", type: "hidden" } });
    fire("error", scriptError());
    await settle();
    hide();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload on pagehide, and recovers after pageshow or a cancelled beforeunload", async () => {
    const a = run();
    a.fire("error", scriptError());
    await a.settle();
    a.fire("pagehide");
    a.hide();
    expect(a.reload).not.toHaveBeenCalled();
    a.fire("pageshow");
    a.show();
    a.hide();
    expect(a.reload).toHaveBeenCalledTimes(1);

    const b = run();
    b.fire("error", scriptError());
    await b.settle();
    vi.useFakeTimers();
    try {
      b.fire("beforeunload");
      b.hide();
      expect(b.reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1100);
      b.show();
      b.hide();
      expect(b.reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("checks the file once while a check is pending", async () => {
    const { fire, fetchMock } = run();
    fire("error", scriptError());
    fire("error", scriptError());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reload while the browser is already navigating away", async () => {
    const { fire, hide, reload, settle } = run();
    fire("error", scriptError());
    fire("beforeunload");
    await settle();
    hide();
    expect(reload).not.toHaveBeenCalled();
  });

  it("turns the next same-origin link click into a full navigation once stale", async () => {
    const { fire, assign, settle } = run();
    const before = link("https://lax.test/sales");
    fire("click", before);
    expect(assign).not.toHaveBeenCalled();
    fire("error", scriptError());
    await settle();
    const click = link("https://lax.test/sales");
    fire("click", click);
    expect(click.preventDefault).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("https://lax.test/sales");
  });

  it("leaves external, new-tab, download and modified clicks alone", async () => {
    const { fire, assign, settle } = run();
    fire("error", scriptError());
    await settle();
    fire("click", link("https://elsewhere.test/"));
    fire("click", link("https://lax.test/a", { target: "_blank" }));
    fire("click", link("https://lax.test/a", { hasAttribute: () => true }));
    fire("click", { ...link("https://lax.test/a"), metaKey: true });
    fire("click", link("https://lax.test/lots/1"));
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not reload twice within the guard window, including from the old key name", async () => {
    const recent = String(Date.now() - STALE_CHUNK_RELOAD_GUARD_MS / 2);
    for (const input of [{ stored: recent }, { legacyStored: recent }]) {
      const { fire, hide, reload, settle } = run(input);
      fire("error", scriptError());
      await settle();
      hide();
      expect(reload).not.toHaveBeenCalled();
    }
  });

  it("leaves connection problems alone: still there, offline, or the check itself failing", async () => {
    for (const input of [{ status: 200 }, { online: false }, { fetchFails: true }]) {
      const { fire, hide, reload, settle } = run(input);
      fire("error", scriptError());
      await settle();
      hide();
      expect(reload).not.toHaveBeenCalled();
    }
  });

  it("ignores failures that are not build files", async () => {
    const { fire, fetchMock, settle } = run();
    fire("error", scriptError("https://www.googletagmanager.com/gtm.js"));
    fire("error", { target: { tagName: "IMG", src: chunk } });
    fire("unhandledrejection", { reason: new Error("boom") });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
