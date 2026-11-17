import { describe, expect, it } from "vitest";
import {
  DeterministicSizeBuildPlugin,
  addSizeBuildDeterminism,
  contentDebugId,
  isRouteJsSizeBuild,
  sortMapByKey,
  sortModulesByIdentifier,
  uuidFromString,
} from "./next-size-build.js";

const SIZE = { ROUTE_JS_SIZE_BUILD: "1" } as NodeJS.ProcessEnv;
const DEPLOY = {} as NodeJS.ProcessEnv;
const mod = (id: string) => ({ identifier: () => id });

describe("size build settings", () => {
  it("apply only when ROUTE_JS_SIZE_BUILD is 1", () => {
    expect(isRouteJsSizeBuild(SIZE)).toBe(true);
    expect(isRouteJsSizeBuild(DEPLOY)).toBe(false);
    expect(isRouteJsSizeBuild({ ROUTE_JS_SIZE_BUILD: "true" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("add the plugin to production client size builds only", () => {
    const client = { isServer: false, dev: false };
    const size: { plugins?: unknown[] } = {};
    addSizeBuildDeterminism(size, client, SIZE);
    expect(size.plugins?.[0]).toBeInstanceOf(DeterministicSizeBuildPlugin);

    for (const [config, options, env] of [
      [{ plugins: [] }, client, DEPLOY],
      [{ plugins: [] }, { isServer: true, dev: false }, SIZE],
      [{ plugins: [] }, { isServer: false, dev: true }, SIZE],
    ] as const) {
      const copy = { plugins: [...config.plugins] as unknown[] };
      addSizeBuildDeterminism(copy, options, env);
      expect(copy.plugins).toEqual([]);
    }
  });
});

describe("DeterministicSizeBuildPlugin", () => {
  it("sorts entries by name and modules by identifier, in place", () => {
    const entries = new Map<string, number>([
      ["app/b/page", 1],
      ["main-app", 2],
      ["app/a/page", 3],
    ]);
    const sameMap = entries;
    sortMapByKey(entries);
    expect(entries).toBe(sameMap);
    expect([...entries.keys()]).toEqual(["app/a/page", "app/b/page", "main-app"]);

    const modules = new Set([mod("c"), mod("a"), mod("b")]);
    sortModulesByIdentifier(modules);
    expect([...modules].map((m) => m.identifier())).toEqual(["a", "b", "c"]);
  });

  it("gives the same order whatever order the build produced", () => {
    const names = ["x", "m", "a", "q", "b"];
    const orders = [names, [...names].reverse(), ["q", "a", "x", "b", "m"]];
    const results = orders.map((order) => {
      const set = new Set(order.map(mod));
      sortModulesByIdentifier(set);
      return [...set].map((m) => m.identifier()).join();
    });
    expect(new Set(results).size).toBe(1);
  });

  it("sorts at seal (entries) and optimize (modules), and re-derives debug ids after Sentry's banner", () => {
    const taps: Record<string, (assets?: Record<string, { source(): string }>) => void> = {};
    let assetStage = 0;
    const id = "0e2c0219-b93b-4aeb-a978-779c97b14ee3";
    const files: Record<string, { source(): string }> = {
      "static/chunks/1.js": { source: () => snippet(id, "let a=1;") },
      "static/css/1.css": { source: () => `/* ${id} */` },
    };
    const compilation = {
      entries: new Map<string, unknown>([
        ["z", 1],
        ["a", 2],
      ]),
      modules: new Set([mod("2"), mod("1")]),
      hooks: {
        seal: {
          tap: (_: string, fn: () => void) => {
            taps.seal = fn;
          },
        },
        optimize: {
          tap: (_: string, fn: () => void) => {
            taps.optimize = fn;
          },
        },
        processAssets: {
          tap: (options: { stage: number }, fn: (assets: Record<string, unknown>) => void) => {
            assetStage = options.stage;
            taps.assets = fn as (assets?: Record<string, { source(): string }>) => void;
          },
        },
      },
      getAsset: (name: string) => ({ source: files[name] as { source(): string } }),
      updateAsset: (name: string, source: { source(): string }) => {
        files[name] = source;
      },
    };
    class FakeReplaceSource {
      private edits: [number, number, string][] = [];
      constructor(private readonly original: { source(): string }) {}
      replace(start: number, end: number, text: string) {
        this.edits.push([start, end, text]);
      }
      source() {
        let code = this.original.source();
        for (const [start, end, text] of [...this.edits].reverse()) {
          code = code.slice(0, start) + text + code.slice(end + 1);
        }
        return code;
      }
    }
    new DeterministicSizeBuildPlugin().apply({
      webpack: {
        Compilation: { PROCESS_ASSETS_STAGE_ADDITIONS: -100 },
        sources: { ReplaceSource: FakeReplaceSource },
      },
      hooks: { compilation: { tap: (_, fn) => fn(compilation) } },
    });
    taps.seal?.();
    expect([...compilation.entries.keys()]).toEqual(["a", "z"]);
    expect([...compilation.modules].map((m) => m.identifier())).toEqual(["2", "1"]);
    taps.optimize?.();
    expect([...compilation.modules].map((m) => m.identifier())).toEqual(["1", "2"]);

    expect(assetStage).toBe(-99);
    taps.assets?.({ ...files });
    const expected = snippet(uuidFromString(snippet("", "let a=1;")), "let a=1;");
    expect(files["static/chunks/1.js"]?.source()).toBe(expected);
    expect(files["static/css/1.css"]?.source()).toBe(`/* ${id} */`);
  });
});

const snippet = (id: string, code: string) =>
  `!function(){try{var e=window,n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="${id}",e._sentryDebugIdIdentifier="sentry-dbid-${id}")}catch(e){}}();${code}`;

describe("contentDebugId", () => {
  it("derives the id from the code, so identical code gets one id whatever webpack hashed", () => {
    const a = snippet("0e2c0219-b93b-4aeb-a978-779c97b14ee3", "let a=1;");
    const b = snippet("a70ebdc8-bbd6-4bc9-ae01-5da46f18457a", "let a=1;");
    const editA = contentDebugId(a);
    const editB = contentDebugId(b);
    expect(editA?.to).toBeDefined();
    expect(editA?.to).toBe(editB?.to);
    expect(editA?.positions).toHaveLength(2);
    expect(editA?.to).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("gives different code a different id, and leaves scripts without one alone", () => {
    const one = contentDebugId(snippet("0e2c0219-b93b-4aeb-a978-779c97b14ee3", "let a=1;"));
    const two = contentDebugId(snippet("0e2c0219-b93b-4aeb-a978-779c97b14ee3", "let a=2;"));
    expect(one?.to).not.toBe(two?.to);
    expect(contentDebugId("let a=1;")).toBeNull();
    const settled = snippet(one?.to ?? "", "let a=1;");
    expect(contentDebugId(settled)).toBeNull();
  });

  it("makes ids in the Sentry plugin's format", () => {
    expect(uuidFromString("x")).toHaveLength(36);
    expect(uuidFromString("x")).toBe(uuidFromString("x"));
  });
});
