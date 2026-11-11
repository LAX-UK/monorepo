/**
 * Module-level facts about built chunks, for counting duplicated code.
 *
 * Webpack chunks register their modules with `(self.webpackChunk_N_E = ...).push([[ids], {id: fn}])`.
 * Running a chunk against a stub `self` yields each module id with its source length, without
 * executing any module. The same id in two chunks a page loads is one module shipped twice.
 */
import vm from "node:vm";

/** Module id to source length in bytes for one chunk's code; empty when it registers none. */
export function chunkModules(code) {
  const modules = new Map();
  const self = {
    webpackChunk_N_E: {
      push(entry) {
        for (const [id, factory] of Object.entries(entry?.[1] ?? {})) {
          modules.set(id, String(factory).length);
        }
      },
    },
  };
  try {
    vm.runInNewContext(code, { self }, { timeout: 2000 });
  } catch {
    // The webpack runtime chunk needs a browser; it registers no modules.
  }
  return modules;
}

/**
 * Modules shipped more than once among the files a route loads. `chunks` maps each file to
 * `{ gzipKb, rawBytes, modules }`. The duplicate weight is each extra copy's share of its chunk's
 * gzip size, an estimate that follows the chunk's own compression ratio.
 */
export function duplicateModules(chunks) {
  const firstSeen = new Set();
  let count = 0;
  let kb = 0;
  for (const { gzipKb, rawBytes, modules } of Object.values(chunks)) {
    for (const [id, bytes] of modules) {
      if (!firstSeen.has(id)) {
        firstSeen.add(id);
        continue;
      }
      count += 1;
      kb += rawBytes > 0 ? (bytes / rawBytes) * gzipKb : 0;
    }
  }
  return { count, kb };
}
