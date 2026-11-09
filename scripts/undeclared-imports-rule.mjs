/**
 * Which bare imports a workspace may use: every package a source file imports must be listed in
 * that workspace's own package.json. pnpm hoisting lets an undeclared import resolve in the
 * monorepo while the Docker build, which installs only the app's own dependencies, fails.
 *
 * Test files (tests, plus the helpers, mocks and fixtures only tests load) may also use
 * devDependencies. Source files of an app ship in a Docker image, so a
 * value import there needs `dependencies` (or `peerDependencies`); a type-only import is erased
 * at build time and may use `devDependencies`.
 */
import { builtinModules } from "node:module";
import ts from "typescript";

const BUILTINS = new Set(builtinModules);
const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const TEST_DIRECTORY_RE = /(?:^|\/)(?:__tests__|__mocks__|__fixtures__|test|testing)\//;
const TEST_SUPPORT_FILE_RE =
  /(?:^|[.-])(?:test-helpers|test-doubles|helpers|mock|fixture)\.[cm]?[jt]sx?$/;
const RUNTIME_DEPENDENCY_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"];

/** Tests and the helpers, mocks and fixtures that only tests load. */
export function isTestFile(relativePath) {
  return (
    TEST_FILE_RE.test(relativePath) ||
    TEST_DIRECTORY_RE.test(relativePath) ||
    TEST_SUPPORT_FILE_RE.test(relativePath)
  );
}

/** The package a bare specifier belongs to: `@scope/name/sub` -> `@scope/name`, `a/b` -> `a`. */
export function packageNameOf(specifier) {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : (segments[0] ?? specifier);
}

function isNodeBuiltin(specifier) {
  if (specifier.startsWith("node:")) return true;
  return BUILTINS.has(specifier) || BUILTINS.has(packageNameOf(specifier));
}

function matchesAlias(specifier, aliasPatterns) {
  return aliasPatterns.some((pattern) => {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return pattern.endsWith("*") ? specifier.startsWith(prefix) : specifier === pattern;
  });
}

/** True when the specifier is a file path, built-in, tsconfig alias or the package itself. */
function needsNoDeclaration(specifier, { aliasPatterns, packageName }) {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#") ||
    isNodeBuiltin(specifier) ||
    matchesAlias(specifier, aliasPatterns) ||
    packageNameOf(specifier) === packageName
  );
}

/**
 * Problems for one imported specifier, or null when it is allowed.
 *
 * @param {string} specifier
 * @param {{ manifest: object; isApp: boolean; isTest: boolean; typeOnly?: boolean; aliasPatterns: string[] }} context
 */
export function undeclaredImportProblem(specifier, context) {
  const { manifest, isApp, isTest, aliasPatterns, typeOnly = false } = context;
  if (needsNoDeclaration(specifier, { aliasPatterns, packageName: manifest.name })) return null;

  const name = packageNameOf(specifier);
  const declaredAtRuntime = RUNTIME_DEPENDENCY_FIELDS.some((field) => manifest[field]?.[name]);
  if (declaredAtRuntime) return null;

  const declaredAsDev = Boolean(manifest.devDependencies?.[name]);
  if (declaredAsDev && (isTest || !isApp || typeOnly)) return null;
  if (declaredAsDev) {
    return `${name} is a devDependency but app source ships in the Docker image: move it to dependencies`;
  }
  return `${name} is not declared in package.json`;
}

/**
 * Every module a source file imports, requires or re-exports with a string literal.
 *
 * @returns {{ specifier: string; typeOnly: boolean }[]}
 */
export function importedModules(fileName, source) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const modules = [];
  const add = (literal, typeOnly) => {
    if (literal && ts.isStringLiteralLike(literal))
      modules.push({ specifier: literal.text, typeOnly });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      add(node.moduleSpecifier, Boolean(node.importClause?.isTypeOnly));
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, true);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isLoader =
        callee.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(callee) && callee.text === "require");
      if (isLoader) add(node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return modules;
}
