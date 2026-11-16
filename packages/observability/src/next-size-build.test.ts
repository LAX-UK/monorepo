import { describe, expect, it } from "vitest";
import {
  DeterministicSizeBuildPlugin,
  addSizeBuildDeterminism,
  isRouteJsSizeBuild,
  sortMapByKey,
  sortModulesByIdentifier,
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

  it("sorts at seal (entries) and optimize (modules)", () => {
    const taps: Record<string, () => void> = {};
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
      },
    };
    new DeterministicSizeBuildPlugin().apply({
      hooks: { compilation: { tap: (_, fn) => fn(compilation) } },
    });
    taps.seal?.();
    expect([...compilation.entries.keys()]).toEqual(["a", "z"]);
    expect([...compilation.modules].map((m) => m.identifier())).toEqual(["2", "1"]);
    taps.optimize?.();
    expect([...compilation.modules].map((m) => m.identifier())).toEqual(["1", "2"]);
  });
});
