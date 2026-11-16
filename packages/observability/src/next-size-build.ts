/**
 * Settings for CI's route JavaScript size-measurement builds (`ROUTE_JS_SIZE_BUILD=1`, see
 * docs/engineering/route-js-budgets.md, "Base vs head"). Each app's `next.config.ts` applies them;
 * every other build (local, deploy images) gets nothing from here and is unchanged.
 */

/** True only in CI's size-measurement builds. */
export function isRouteJsSizeBuild(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ROUTE_JS_SIZE_BUILD === "1";
}

/** The parts of a webpack module this file reads. */
type ModuleLike = { identifier(): string };

/** The parts of a webpack compilation this file touches. */
type CompilationLike = {
  entries: Map<string, unknown>;
  modules: Set<ModuleLike>;
  hooks: {
    seal: { tap(name: string, fn: () => void): void };
    optimize: { tap(name: string, fn: () => void): void };
  };
};

type CompilerLike = {
  hooks: { compilation: { tap(name: string, fn: (compilation: CompilationLike) => void): void } };
};

const PLUGIN = "DeterministicSizeBuild";

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Re-inserts the entries of `map` sorted by key, keeping the same Map object. */
export function sortMapByKey<V>(map: Map<string, V>): void {
  const sorted = [...map].sort(([a], [b]) => byString(a, b));
  map.clear();
  for (const [key, value] of sorted) map.set(key, value);
}

/** Re-inserts the modules of `set` sorted by webpack identifier, keeping the same Set object. */
export function sortModulesByIdentifier<M extends ModuleLike>(set: Set<M>): void {
  const sorted = [...set].sort((a, b) => byString(a.identifier(), b.identifier()));
  set.clear();
  for (const module of sorted) set.add(module);
}

/**
 * Makes two client builds of one commit byte-identical. Two webpack orders follow the order in
 * which asynchronous work finished, not the code:
 *
 * - **Entries.** Next adds the client entries of the app router while it walks the server build,
 *   so their order varies. The chunk graph numbers modules in entry order (pre-order index), and
 *   deterministic module ids use that number to settle a hash collision: the same module got id
 *   62629 in one Bid build and 29772 in the next, which moved `/(client)/purchases/pay` and Bid
 *   home by 5 to 10 bytes.
 * - **Modules.** `compilation.modules` is in build-completion order. The split-chunks step keeps
 *   the first of two equally good candidates in that order, so a page could get either of two
 *   chunks with the same modules (six such pairs in Bid; `/(marketing)/sell/*` loads one).
 *
 * The plugin sorts both by name before webpack uses them (`seal`, then `optimize`), so ties are
 * settled the same way every time. Any order is a valid build; this one is just fixed.
 */
export class DeterministicSizeBuildPlugin {
  apply(compiler: CompilerLike): void {
    compiler.hooks.compilation.tap(PLUGIN, (compilation) => {
      compilation.hooks.seal.tap(PLUGIN, () => sortMapByKey(compilation.entries));
      compilation.hooks.optimize.tap(PLUGIN, () => sortModulesByIdentifier(compilation.modules));
    });
  }
}

/**
 * Adds {@link DeterministicSizeBuildPlugin} to a production client build when this is a size
 * build. Call it from the app's `webpack(config, { isServer, dev })` hook.
 */
export function addSizeBuildDeterminism(
  config: { plugins?: unknown[] },
  { isServer, dev }: { isServer: boolean; dev: boolean },
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (isServer || dev || !isRouteJsSizeBuild(env)) return;
  config.plugins = config.plugins ?? [];
  config.plugins.push(new DeterministicSizeBuildPlugin());
}
