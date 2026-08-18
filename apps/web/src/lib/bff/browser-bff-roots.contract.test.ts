import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { isApprovedProxyPath } from "./proxy-policy";

const srcRoot = join(__dirname, "../..");
const canonicalBaseExports = new Set(["apiBaseUrl", "browserApiBase", "clientApiBase"]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (
      entry.isFile() &&
      /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.(?:test|server)\.(?:ts|tsx)$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

function rootAfterBase(text: string): string | null {
  const match = /^\/([^/?#${}]+)/.exec(text);
  return match?.[1] ?? null;
}

function rootsFromFile(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const baseFunctions = new Set<string>();
  const baseVariables = new Set<string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    if (
      !["@/lib/auth/api-base", "@/lib/api/client-api-base", "@/lib/data/http/hc-browser"].includes(
        moduleName,
      )
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (canonicalBaseExports.has(element.propertyName?.text ?? element.name.text)) {
        baseFunctions.add(element.name.text);
      }
    }
  }

  const isBaseExpression = (node: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(node)) return isBaseExpression(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text === "/api/bff";
    }
    if (ts.isIdentifier(node)) return baseVariables.has(node.text);
    return (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.arguments.length === 0 &&
      baseFunctions.has(node.expression.text)
    );
  };

  let changed = true;
  while (changed) {
    changed = false;
    const collect = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        isBaseExpression(node.initializer) &&
        !baseVariables.has(node.name.text)
      ) {
        baseVariables.add(node.name.text);
        changed = true;
      }
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.parameters.length === 0 &&
        node.body
      ) {
        const returned = node.body.statements.find(ts.isReturnStatement)?.expression;
        if (returned && isBaseExpression(returned) && !baseFunctions.has(node.name.text)) {
          baseFunctions.add(node.name.text);
          changed = true;
        }
      }
      ts.forEachChild(node, collect);
    };
    collect(source);
  }

  const roots = new Set<string>();
  const inspect = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (node.text.startsWith("/api/bff/")) {
        const root = rootAfterBase(node.text.slice("/api/bff".length));
        if (root) roots.add(root);
      }
    } else if (ts.isTemplateExpression(node)) {
      const first = node.templateSpans[0];
      if (node.head.text === "" && first && isBaseExpression(first.expression)) {
        const root = rootAfterBase(first.literal.text);
        if (root) roots.add(root);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  return [...roots];
}

describe("browser BFF root contract", () => {
  it("keeps every statically declared browser BFF root on the proxy allowlist", () => {
    const violations: string[] = [];
    const discovered = new Set<string>();
    for (const path of sourceFiles(srcRoot)) {
      for (const root of rootsFromFile(path)) {
        discovered.add(root);
        if (!isApprovedProxyPath([root])) {
          violations.push(`${relative(srcRoot, path)} uses disallowed root "${root}"`);
        }
      }
    }

    expect(discovered).toContain("telephone-bookings");
    expect(violations).toEqual([]);
  }, 60_000);
});
