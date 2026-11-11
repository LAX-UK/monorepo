/**
 * Pure helpers for `route-bundle-report.mjs`: turn the bundle analyser's per-chunk module tree into
 * "who owns the bytes" for one route's start-up files.
 */

/** Concatenated modules are listed as `entry + N modules (concatenated)/real/path`; keep the real path. */
export function realModulePath(path) {
  const marker = "(concatenated)/";
  const at = path.lastIndexOf(marker);
  return at === -1 ? path : path.slice(at + marker.length);
}

/**
 * The owner of a module: its npm package (`next (bundled react-dom)` for what Next compiles in), `@auction/<workspace>` for code in `packages/`, or the
 * app itself for its own `src`.
 */
export function moduleOwner(path) {
  const real = realModulePath(path);
  const compiled = real.match(/node_modules\/next\/dist\/compiled\/((?:@[^/]+\/)?[^/]+)/);
  if (compiled) return `next (bundled ${compiled[1]})`;
  const npm = real.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/g);
  if (npm) {
    const last = npm[npm.length - 1];
    return last.replace(/^.*node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?/, "");
  }
  const workspace = real.match(/(?:^|\/)packages\/([^/]+)\//);
  if (workspace) return `@auction/${workspace[1]}`;
  return "app source";
}

/** The shared-kit file a module comes from, such as `components/button.tsx`, or null outside kits. */
export function kitFile(path, kit) {
  const real = realModulePath(path);
  const marker = `packages/${kit}/`;
  const at = real.indexOf(marker);
  if (at === -1) return null;
  return real.slice(at + marker.length).replace(/^(src|dist)\//, "");
}

/** Every leaf module of an analyser chunk tree. */
export function leafModules(group, out = []) {
  if (group.groups?.length) {
    for (const child of group.groups) leafModules(child, out);
  } else if (group.path) {
    out.push(group);
  }
  return out;
}

/**
 * Bytes per owner across the given chunks. Each module's minified size is scaled by its chunk's
 * gzip-to-minified ratio, so the numbers add up to the chunk's real gzip size.
 */
export function ownerTotals(chunks) {
  const totals = new Map();
  for (const chunk of chunks) {
    const ratio = chunk.parsedSize > 0 ? chunk.gzipSize / chunk.parsedSize : 0;
    for (const leaf of leafModules(chunk)) {
      const owner = moduleOwner(leaf.path);
      const entry = totals.get(owner) ?? { gzipKb: 0, minifiedKb: 0, modules: 0 };
      entry.gzipKb += ((leaf.parsedSize ?? 0) * ratio) / 1024;
      entry.minifiedKb += (leaf.parsedSize ?? 0) / 1024;
      entry.modules += 1;
      totals.set(owner, entry);
    }
  }
  return [...totals.entries()]
    .map(([owner, value]) => ({ owner, ...value }))
    .sort((a, b) => b.gzipKb - a.gzipKb);
}

/** The kit's files the route ships, largest first, with the same gzip scaling. */
export function kitFiles(chunks, kit) {
  const files = new Map();
  for (const chunk of chunks) {
    const ratio = chunk.parsedSize > 0 ? chunk.gzipSize / chunk.parsedSize : 0;
    for (const leaf of leafModules(chunk)) {
      const file = kitFile(leaf.path, kit);
      if (file) files.set(file, (files.get(file) ?? 0) + ((leaf.parsedSize ?? 0) * ratio) / 1024);
    }
  }
  return [...files.entries()]
    .map(([file, gzipKb]) => ({ file, gzipKb }))
    .sort((a, b) => b.gzipKb - a.gzipKb);
}
