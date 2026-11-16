import { createHash } from "node:crypto";

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

/** The parts of a webpack-sources source this file uses. */
type SourceLike = { source(): string | Buffer };

type ReplaceSourceLike = SourceLike & { replace(start: number, end: number, text: string): void };

/** The parts of a webpack compilation this file touches. */
type CompilationLike = {
  entries: Map<string, unknown>;
  modules: Set<ModuleLike>;
  hooks: {
    seal: { tap(name: string, fn: () => void): void };
    optimize: { tap(name: string, fn: () => void): void };
    processAssets: {
      tap(
        options: { name: string; stage: number },
        fn: (assets: Record<string, SourceLike>) => void,
      ): void;
    };
  };
  getAsset(name: string): { source: SourceLike } | undefined;
  updateAsset(name: string, source: SourceLike): void;
};

type CompilerLike = {
  webpack: {
    Compilation: { PROCESS_ASSETS_STAGE_ADDITIONS: number };
    sources: { ReplaceSource: new (source: SourceLike) => ReplaceSourceLike };
  };
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

/** A v4-shaped UUID from a SHA-256 hash, in the same format the Sentry plugin uses for debug ids. */
export function uuidFromString(text: string): string {
  const hash = createHash("sha256").update(text).digest("hex");
  const variant = ["8", "9", "a", "b"][hash.charCodeAt(16) % 4];
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const DEBUG_ID =
  /_sentryDebugIds\[[^\]]+\]="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/;

/**
 * The Sentry debug id a chunk's code should carry in a size build: one derived from the code
 * itself (with the old id taken out), so identical code always gets the same id. Returns the
 * current id, the new one and every position of the current id, or `null` for a script without a
 * debug id or one that already carries the right id.
 */
export function contentDebugId(
  code: string,
): { from: string; to: string; positions: number[] } | null {
  const from = DEBUG_ID.exec(code)?.[1];
  if (!from) return null;
  const to = uuidFromString(code.split(from).join(""));
  if (to === from) return null;
  const positions: number[] = [];
  for (let at = code.indexOf(from); at !== -1; at = code.indexOf(from, at + from.length)) {
    positions.push(at);
  }
  return { from, to, positions };
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
 *
 * - **Sentry debug ids.** The Sentry plugin derives each chunk's debug id from webpack's content
 *   hash, which hashes how the modules were built (sources, source maps, module graph data), not
 *   the code the chunk ends up with. Under load that hash can change while the code does not
 *   (lax.art and Account chunks of about 410 KB came out identical except for the id). The id
 *   then changes how terser names variables, the chunk's file name and the webpack runtime that
 *   lists it, so every route of the app moved by 1 or 2 bytes. The plugin replaces each id, right
 *   after Sentry adds it and before minifying, with one derived from the chunk's code. The id
 *   keeps its length and format, so sizes stay what visitors download; it is only never uploaded
 *   (size builds have no Sentry token).
 */
export class DeterministicSizeBuildPlugin {
  apply(compiler: CompilerLike): void {
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.compilation.tap(PLUGIN, (compilation) => {
      compilation.hooks.seal.tap(PLUGIN, () => sortMapByKey(compilation.entries));
      compilation.hooks.optimize.tap(PLUGIN, () => sortModulesByIdentifier(compilation.modules));
      // Just after the Sentry plugin's banner (same stage, registered earlier) and long before
      // the minifier (PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE).
      compilation.hooks.processAssets.tap(
        { name: PLUGIN, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS + 1 },
        (assets) => {
          for (const name of Object.keys(assets)) {
            if (!/\.[cm]?js$/.test(name)) continue;
            const asset = compilation.getAsset(name);
            if (!asset) continue;
            const edit = contentDebugId(String(asset.source.source()));
            if (!edit) continue;
            const source = new sources.ReplaceSource(asset.source);
            for (const at of edit.positions) source.replace(at, at + edit.from.length - 1, edit.to);
            compilation.updateAsset(name, source);
          }
        },
      );
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
