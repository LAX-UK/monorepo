/**
 * Package barrels that Bid's web app must not import from. Each barrel re-exports the whole kit, so
 * an import of it can only stay small while the bundler's package-import rewrite recognises the
 * statement; a narrow subpath is small by construction and keeps the module graph readable.
 * Import from the component's own path instead, for example `@auction/ui/components/button`,
 * `@auction/ui/lax/button` or `@auction/marketing-ui/header/marketing-header`.
 */
export const BARREL_SPECIFIERS = ["@auction/ui", "@auction/ui/lax", "@auction/marketing-ui"];

const MODULE_REFERENCE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|vi\.(?:mock|doMock)\(\s*)"([^"]+)"/g;

/** The barrel specifiers a source file refers to, in order, one entry per reference. */
export function barrelImports(source) {
  const found = [];
  for (const match of source.matchAll(MODULE_REFERENCE)) {
    if (BARREL_SPECIFIERS.includes(match[1])) found.push(match[1]);
  }
  return found;
}
