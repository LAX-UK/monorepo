import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type SavedView,
  SavedViewsError,
  type SavedViewsPort,
  migrateLegacySavedViews,
  useSavedViews,
} from "./saved-views.js";
import { sameViewQuery, viewQuery } from "./view-query.js";

const LIST = "test.orders";
const STORAGE_KEY = `staff.views.${LIST}`;

const view = (id: string, label = id, query = `q=${id}`): SavedView => ({ id, label, query });

/** A port over an in-memory list, with spies so tests can fail or hold any call. */
function fakePort(initial: SavedView[] = []) {
  const server = [...initial];
  let next = 1;
  const port = {
    load: vi.fn(async () => server.map((item) => ({ ...item }))),
    create: vi.fn(async (input: { label: string; query: string }) => {
      if (server.some((item) => item.label === input.label)) {
        throw new SavedViewsError("duplicate", "You already have a view with that name.");
      }
      const created = { id: `server-${next++}`, ...input };
      server.push(created);
      return { ...created };
    }),
    rename: vi.fn(async (id: string, label: string) => {
      const found = server.find((item) => item.id === id);
      if (!found) throw new SavedViewsError("stale", "View not found");
      found.label = label;
      return { ...found };
    }),
    reorder: vi.fn(async (ids: readonly string[]) => {
      const sorted = ids.map((id) => server.find((item) => item.id === id) as SavedView);
      server.splice(0, server.length, ...sorted);
    }),
    remove: vi.fn(async (id: string) => {
      const index = server.findIndex((item) => item.id === id);
      if (index >= 0) server.splice(index, 1);
    }),
  } satisfies SavedViewsPort;
  return { port, server };
}

/** Holds a call open until the test releases it. */
function gate<T>() {
  let release: (value: T) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  return { promise, release, fail };
}

const labels = (views: { label: string }[]) => views.map((item) => item.label);

async function ready(port: SavedViewsPort) {
  const hook = renderHook(() => useSavedViews(LIST, port));
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

/** The test runtime's own localStorage is not reliably a full Storage; use a plain one. */
function installStorage() {
  const entries = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, String(value)),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
    },
  });
}

beforeEach(() => {
  installStorage();
});

describe("useSavedViews", () => {
  it("loads the person's views from the port", async () => {
    const { port } = fakePort([view("a", "Paid"), view("b", "Refunded")]);
    const { result } = await ready(port);

    expect(labels(result.current.views)).toEqual(["Paid", "Refunded"]);
  });

  it("reports a failed load and loads again on retry", async () => {
    const { port } = fakePort([view("a", "Paid")]);
    port.load.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useSavedViews(LIST, port));
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(labels(result.current.views)).toEqual(["Paid"]);
  });

  describe("saving", () => {
    it("shows the view at once, then settles on the stored one", async () => {
      const { port } = fakePort();
      const held = gate<SavedView>();
      port.create.mockReturnValueOnce(held.promise);
      const { result } = await ready(port);

      let saving: Promise<unknown> = Promise.resolve();
      act(() => {
        saving = result.current.save("Paid this week", "status=paid");
      });
      expect(result.current.views).toEqual([
        {
          id: expect.stringMatching(/^pending-/),
          label: "Paid this week",
          query: "status=paid",
          pending: true,
        },
      ]);

      await act(async () => {
        held.release(view("server-1", "Paid this week", "status=paid"));
        await saving;
      });
      expect(result.current.views).toEqual([view("server-1", "Paid this week", "status=paid")]);
    });

    it("takes the view back out and explains when the server refuses", async () => {
      const { port } = fakePort([view("a", "Paid")]);
      const { result } = await ready(port);

      let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
      await act(async () => {
        outcome = await result.current.save("Paid", "status=paid");
      });

      expect(outcome).toEqual({
        ok: false,
        code: "duplicate",
        message: "You already have a view with that name.",
      });
      expect(labels(result.current.views)).toEqual(["Paid"]);
    });

    it("gives a generic message for an unexpected failure", async () => {
      const { port } = fakePort();
      port.create.mockRejectedValueOnce(new TypeError("network"));
      const { result } = await ready(port);

      let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
      await act(async () => {
        outcome = await result.current.save("Paid", "status=paid");
      });

      expect(outcome).toEqual({
        ok: false,
        code: "failed",
        message: "Something went wrong. Try again.",
      });
      expect(result.current.views).toEqual([]);
    });
  });

  describe("renaming", () => {
    it("shows the new name at once and keeps it", async () => {
      const { port, server } = fakePort([view("a", "Paid")]);
      const held = gate<SavedView>();
      port.rename.mockReturnValueOnce(held.promise);
      const { result } = await ready(port);

      let renaming: Promise<unknown> = Promise.resolve();
      act(() => {
        renaming = result.current.rename("a", "Paid in full");
      });
      expect(labels(result.current.views)).toEqual(["Paid in full"]);

      await act(async () => {
        held.release(view("a", "Paid in full"));
        await renaming;
      });
      expect(labels(result.current.views)).toEqual(["Paid in full"]);
      expect(server).toHaveLength(1);
    });

    it("puts the old name back when the server refuses", async () => {
      const { port } = fakePort([view("a", "Paid"), view("b", "Refunded")]);
      port.rename.mockRejectedValueOnce(
        new SavedViewsError("duplicate", "You already have a view with that name."),
      );
      const { result } = await ready(port);

      let outcome: Awaited<ReturnType<typeof result.current.rename>> | undefined;
      await act(async () => {
        outcome = await result.current.rename("a", "Refunded");
      });

      expect(outcome).toMatchObject({ ok: false, code: "duplicate" });
      expect(labels(result.current.views)).toEqual(["Paid", "Refunded"]);
    });
  });

  describe("deleting", () => {
    it("removes the view at once", async () => {
      const { port, server } = fakePort([view("a"), view("b"), view("c")]);
      const { result } = await ready(port);

      await act(async () => {
        await result.current.remove("b");
      });

      expect(labels(result.current.views)).toEqual(["a", "c"]);
      expect(server.map((item) => item.id)).toEqual(["a", "c"]);
    });

    it("brings the view back in its place when the server refuses", async () => {
      const { port } = fakePort([view("a"), view("b"), view("c")]);
      const held = gate<void>();
      port.remove.mockReturnValueOnce(held.promise);
      const { result } = await ready(port);

      let removing: Promise<unknown> = Promise.resolve();
      act(() => {
        removing = result.current.remove("b");
      });
      expect(labels(result.current.views)).toEqual(["a", "c"]);

      await act(async () => {
        held.fail(new Error("offline"));
        await removing;
      });
      expect(labels(result.current.views)).toEqual(["a", "b", "c"]);
    });
  });

  describe("reordering", () => {
    it("moves the view at once and stores the whole order", async () => {
      const { port, server } = fakePort([view("a"), view("b"), view("c")]);
      const { result } = await ready(port);

      await act(async () => {
        await result.current.move("c", 0);
      });

      expect(labels(result.current.views)).toEqual(["c", "a", "b"]);
      expect(port.reorder).toHaveBeenCalledWith(["c", "a", "b"]);
      expect(server.map((item) => item.id)).toEqual(["c", "a", "b"]);
    });

    it("does nothing when the view is already there", async () => {
      const { port } = fakePort([view("a"), view("b")]);
      const { result } = await ready(port);

      await act(async () => {
        await result.current.move("a", 0);
      });

      expect(port.reorder).not.toHaveBeenCalled();
    });

    it("restores the order when the server refuses", async () => {
      const { port } = fakePort([view("a"), view("b"), view("c")]);
      port.reorder.mockRejectedValueOnce(new Error("offline"));
      const { result } = await ready(port);

      let outcome: Awaited<ReturnType<typeof result.current.move>> | undefined;
      await act(async () => {
        outcome = await result.current.move("c", 0);
      });

      expect(outcome).toMatchObject({ ok: false, code: "failed" });
      expect(labels(result.current.views)).toEqual(["a", "b", "c"]);
    });

    it("loads again when the views changed on another device", async () => {
      const { port, server } = fakePort([view("a"), view("b")]);
      port.reorder.mockRejectedValueOnce(
        new SavedViewsError("stale", "Your views changed on another device."),
      );
      const { result } = await ready(port);
      server.push(view("c"));

      await act(async () => {
        await result.current.move("b", 0);
      });

      await waitFor(() => expect(labels(result.current.views)).toEqual(["a", "b", "c"]));
    });

    it("waits for a view that is still being saved", async () => {
      const { port } = fakePort([view("a"), view("b")]);
      const held = gate<SavedView>();
      port.create.mockReturnValueOnce(held.promise);
      const { result } = await ready(port);
      act(() => {
        void result.current.save("New", "q=new");
      });

      let outcome: Awaited<ReturnType<typeof result.current.move>> | undefined;
      await act(async () => {
        outcome = await result.current.move("b", 0);
      });

      expect(outcome).toMatchObject({ ok: false });
      expect(port.reorder).not.toHaveBeenCalled();
      await act(async () => {
        held.release(view("server-9", "New", "q=new"));
      });
    });
  });

  it("sends changes to the server in the order they were made", async () => {
    const { port } = fakePort([view("a"), view("b")]);
    const firstHeld = gate<SavedView>();
    port.rename.mockReturnValueOnce(firstHeld.promise);
    const { result } = await ready(port);

    let renaming: Promise<unknown> = Promise.resolve();
    let removing: Promise<unknown> = Promise.resolve();
    act(() => {
      renaming = result.current.rename("a", "Alpha");
      removing = result.current.remove("b");
    });
    expect(port.remove).not.toHaveBeenCalled();

    await act(async () => {
      firstHeld.release(view("a", "Alpha"));
      await Promise.all([renaming, removing]);
    });
    expect(port.remove).toHaveBeenCalledWith("b");
    expect(labels(result.current.views)).toEqual(["Alpha"]);
  });
});

describe("comparing views by their filters", () => {
  it("drops paging, so a view is the filters and not the page it was saved on", () => {
    expect(viewQuery("?status=paid&offset=50&cursor=abc&page=2")).toBe("status=paid");
  });

  it("treats the same params in any order, on any page, as the same view", () => {
    expect(sameViewQuery("offset=0&status=draft&needsPhotos=1", "needsPhotos=1&status=draft")).toBe(
      true,
    );
    expect(sameViewQuery("status=draft", "status=active")).toBe(false);
    expect(sameViewQuery("status=draft", "status=draft&q=ada")).toBe(false);
  });
});

describe("migrating views saved in the browser", () => {
  const saveLegacy = (views: SavedView[]) =>
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));

  it("moves them to the server once, then clears the browser", async () => {
    saveLegacy([
      { id: "view-1", label: "Paid this week", query: "status=paid" },
      { id: "view-2", label: "Refunds", query: "status=refunded" },
    ]);
    const { port, server } = fakePort();

    const first = await ready(port);

    expect(port.create).toHaveBeenCalledTimes(2);
    expect(server.map((item) => item.label)).toEqual(["Paid this week", "Refunds"]);
    expect(labels(first.result.current.views)).toEqual(["Paid this week", "Refunds"]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Opening the list again finds nothing to move.
    first.unmount();
    const second = await ready(port);
    expect(port.create).toHaveBeenCalledTimes(2);
    expect(labels(second.result.current.views)).toEqual(["Paid this week", "Refunds"]);
  });

  it("keeps the order they were saved in, after views already on the server", async () => {
    saveLegacy([view("l1", "Local one"), view("l2", "Local two")]);
    const { port } = fakePort([view("s1", "On server")]);

    const { result } = await ready(port);

    expect(labels(result.current.views)).toEqual(["On server", "Local one", "Local two"]);
  });

  it("does not repeat a view the server already has by name", async () => {
    saveLegacy([view("l1", "Paid"), view("l2", "Refunds")]);
    const { port, server } = fakePort([view("s1", "Paid")]);

    await ready(port);

    expect(port.create).toHaveBeenCalledTimes(1);
    expect(server.map((item) => item.label)).toEqual(["Paid", "Refunds"]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("treats a name the server reports as taken as moved", async () => {
    saveLegacy([view("l1", "Paid")]);
    const { port } = fakePort();
    port.create.mockRejectedValueOnce(new SavedViewsError("duplicate", "taken"));

    await ready(port);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("keeps the views it could not move for the next visit", async () => {
    saveLegacy([view("l1", "One"), view("l2", "Two"), view("l3", "Three")]);
    const { port } = fakePort();
    port.create
      .mockImplementationOnce(async (input) => view("server-1", input.label, input.query))
      .mockRejectedValueOnce(new SavedViewsError("limit", "You can keep up to 50 views."));

    const { result } = await ready(port);

    expect(labels(result.current.views)).toEqual(["One"]);
    expect(port.create).toHaveBeenCalledTimes(2);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([
      view("l2", "Two"),
      view("l3", "Three"),
    ]);
  });

  it("leaves the browser's views alone when the list cannot be loaded", async () => {
    saveLegacy([view("l1", "One")]);
    const { port } = fakePort();
    port.load.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useSavedViews(LIST, port));
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(port.create).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("ignores stored data that is not a list of views", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const { port } = fakePort();

    const { result } = await ready(port);

    expect(port.create).not.toHaveBeenCalled();
    expect(result.current.views).toEqual([]);
  });

  it("reads views from the storage key the app says they were kept under", async () => {
    window.localStorage.setItem(
      "staff.views.orders",
      JSON.stringify([view("l1", "Old orders view")]),
    );
    const { port, server } = fakePort();

    const hook = renderHook(() =>
      useSavedViews("lax-admin.orders", port, { legacyStorageKey: "staff.views.orders" }),
    );
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    expect(server.map((item) => item.label)).toEqual(["Old orders view"]);
    expect(window.localStorage.getItem("staff.views.orders")).toBeNull();
  });

  it("only moves the list it is opened for", async () => {
    window.localStorage.setItem(
      "staff.views.test.other",
      JSON.stringify([view("x1", "Elsewhere")]),
    );
    const { port } = fakePort();

    await ready(port);

    expect(port.create).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("staff.views.test.other")).not.toBeNull();
  });

  it("is a plain function that can be run on its own", async () => {
    saveLegacy([view("l1", "One")]);
    const create = vi.fn(async (input: { label: string; query: string }) =>
      view("server-1", input.label, input.query),
    );

    const created = await migrateLegacySavedViews(STORAGE_KEY, [], { create });

    expect(created).toEqual([view("server-1", "One", "q=l1")]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
