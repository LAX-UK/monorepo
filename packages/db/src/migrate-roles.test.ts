import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import {
  API_COLUMN_UPDATE_GRANTS,
  AUTH_FULL_TABLES,
  AUTH_INSERT_TABLES,
  WORKER_DATA_EXPORT_TABLES,
  WORKER_FULL_TABLES,
  WORKER_PROVISIONING_TABLES,
  WORKER_QR_CODE_SCAN_TABLES,
} from "./migrate-roles.js";
import { user } from "./schema/auth.js";

/** AST-based audit of every `db.update(user|userTable).set({ ... })` call in `apps/api`.
 *
 * Why AST and not regex: aliased imports, helpers that take a `set` parameter,
 * spread `...patch`, and comments containing the pattern all cause regex parsers
 * to silently under-report. Missed columns translate to `permission denied for
 * table user` at runtime. The compiler is the source of truth.
 *
 * Bonus: also asserts the allow-list has no unused entries (reverse drift), so
 * api_app's column-level UPDATE surface tracks reality in both directions.
 */

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "../../..");
const apiSrc = join(repoRoot, "apps/api/src");

const USER_TABLE_IDENTIFIERS = new Set(["user", "userTable"]);

function propToDbColumn(prop: string): string | null {
  const cols = getTableColumns(user);
  const col = cols[prop as keyof typeof cols];
  return col ? col.name : null;
}

async function* walkTsFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkTsFiles(p);
    else if (e.isFile() && p.endsWith(".ts") && !p.endsWith(".test.ts")) yield p;
  }
}

/** Pulls a string property name out of an object-literal property assignment.
 * Handles plain identifiers (`emailStatus: ...`), shorthand (`emailStatus`),
 * and string keys (`"email_status": ...`). Computed keys are ignored — they
 * cannot be statically resolved to a column.
 */
function propertyName(prop: ts.ObjectLiteralElementLike): string | null {
  if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
    const name = prop.name;
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  }
  return null;
}

/** True if the call expression is `.update(user)` or `.update(userTable)`. */
function isUserTableUpdate(call: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  if (call.expression.name.text !== "update") return false;
  const [arg] = call.arguments;
  if (!arg || !ts.isIdentifier(arg)) return false;
  return USER_TABLE_IDENTIFIERS.has(arg.text);
}

/** Find the matching `.set(...)` call chained directly off `.update(user)`.
 * Walks up parent property-access until a `.set(` call is reached.
 */
function findSetCall(updateCall: ts.CallExpression): ts.CallExpression | null {
  let cursor: ts.Node = updateCall;
  while (cursor.parent) {
    const parent: ts.Node = cursor.parent;
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === cursor &&
      parent.name.text === "set" &&
      parent.parent &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.expression === parent
    ) {
      return parent.parent;
    }
    if (ts.isPropertyAccessExpression(parent) && parent.expression === cursor) {
      cursor = parent;
      continue;
    }
    if (ts.isCallExpression(parent) && parent.expression === cursor) {
      cursor = parent;
      continue;
    }
    return null;
  }
  return null;
}

/** Resolve the printed receiver expression of `<receiver>.update(user)`.
 *
 * If the receiver is a transaction-callback parameter (e.g. `tx` from
 * `someDb.transaction(async (tx) => { tx.update(user)... })`), recursively
 * resolve to the originating receiver of `.transaction()` so we can detect
 * whether the chain ultimately belongs to `db` or `authDb`.
 */
function resolveUpdateOwner(updateCall: ts.CallExpression, source: ts.SourceFile): string {
  if (!ts.isPropertyAccessExpression(updateCall.expression)) return "<unknown>";
  const receiver = updateCall.expression.expression;
  if (ts.isIdentifier(receiver)) {
    const txOwner = findEnclosingTransactionOwner(updateCall, receiver.text, source);
    if (txOwner) return txOwner;
    return receiver.text;
  }
  return receiver.getText(source);
}

/** If `updateCall` lives inside a `someReceiver.transaction(async (<paramName>) => { ... })`
 * arrow body, return the printed text of `someReceiver` (recursively resolving
 * nested transactions). Otherwise null.
 */
function findEnclosingTransactionOwner(
  node: ts.Node,
  paramName: string,
  source: ts.SourceFile,
): string | null {
  let cursor: ts.Node | undefined = node.parent;
  while (cursor) {
    if (ts.isArrowFunction(cursor) || ts.isFunctionExpression(cursor)) {
      const fn = cursor;
      const firstParam = fn.parameters[0];
      const firstParamName =
        firstParam && ts.isIdentifier(firstParam.name) ? firstParam.name.text : null;
      const callParent = fn.parent;
      if (
        firstParamName === paramName &&
        callParent &&
        ts.isCallExpression(callParent) &&
        ts.isPropertyAccessExpression(callParent.expression) &&
        callParent.expression.name.text === "transaction"
      ) {
        const txReceiver = callParent.expression.expression;
        if (ts.isIdentifier(txReceiver)) {
          const outer = findEnclosingTransactionOwner(callParent, txReceiver.text, source);
          return outer ?? txReceiver.text;
        }
        return txReceiver.getText(source);
      }
    }
    cursor = cursor.parent;
  }
  return null;
}

/** True when the resolved owner of the update chain is routed through `authDb`
 * (top-level `authDb.update(...)`, `container.authDb.update(...)`, or any
 * transaction whose receiver ultimately ends in `authDb`). Such writes are
 * intentionally NOT audited against `api_app`'s grant list.
 */
function ownerIsAuthDb(owner: string): boolean {
  return /(^|[.])authDb$/.test(owner.trim());
}

/** Resolve a `.set(<arg>)` argument to a set of literal property names.
 * - `{ a: ..., b }` → ["a", "b"]
 * - `{ ...spread, a }` → dynamic (can't statically enumerate spread)
 * - `someVar` (parameter) → resolved via local Drizzle-typed declaration if possible,
 *   else dynamic.
 */
function extractSetProps(
  setArg: ts.Expression,
  source: ts.SourceFile,
): { props: Set<string>; dynamic: boolean } {
  const props = new Set<string>();
  let dynamic = false;

  function unwrapParens(expr: ts.Expression): ts.Expression {
    let e: ts.Expression = expr;
    while (ts.isParenthesizedExpression(e)) e = e.expression;
    return e;
  }

  /** Recursively enumerate keys from a spread argument when it is statically
   * resolvable: object literal, ternary of object literals, logical AND/OR.
   * `{}` is a valid leaf (contributes nothing). Anything else is dynamic.
   */
  function spreadKeys(expr: ts.Expression): { keys: Set<string>; dynamic: boolean } {
    const e = unwrapParens(expr);
    if (ts.isObjectLiteralExpression(e)) {
      const inner = new Set<string>();
      let innerDynamic = false;
      for (const p of e.properties) {
        if (ts.isSpreadAssignment(p)) {
          const sub = spreadKeys(p.expression);
          for (const k of sub.keys) inner.add(k);
          innerDynamic = innerDynamic || sub.dynamic;
          continue;
        }
        const name = propertyName(p);
        if (name) inner.add(name);
        else innerDynamic = true;
      }
      return { keys: inner, dynamic: innerDynamic };
    }
    if (ts.isConditionalExpression(e)) {
      const t = spreadKeys(e.whenTrue);
      const f = spreadKeys(e.whenFalse);
      const keys = new Set<string>([...t.keys, ...f.keys]);
      return { keys, dynamic: t.dynamic || f.dynamic };
    }
    if (
      ts.isBinaryExpression(e) &&
      (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        e.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      const l = spreadKeys(e.left);
      const r = spreadKeys(e.right);
      return { keys: new Set([...l.keys, ...r.keys]), dynamic: l.dynamic || r.dynamic };
    }
    return { keys: new Set(), dynamic: true };
  }

  function fromObjectLiteral(obj: ts.ObjectLiteralExpression): void {
    for (const p of obj.properties) {
      if (ts.isSpreadAssignment(p)) {
        const sub = spreadKeys(p.expression);
        for (const k of sub.keys) props.add(k);
        if (sub.dynamic) dynamic = true;
        continue;
      }
      const name = propertyName(p);
      if (name) props.add(name);
      else dynamic = true;
    }
  }

  if (ts.isObjectLiteralExpression(setArg)) {
    fromObjectLiteral(setArg);
    return { props, dynamic };
  }

  if (ts.isIdentifier(setArg)) {
    const decl = findLocalInitializer(setArg, source);
    if (decl && ts.isObjectLiteralExpression(decl)) {
      fromObjectLiteral(decl);
      return { props, dynamic };
    }
    dynamic = true;
    return { props, dynamic };
  }

  dynamic = true;
  return { props, dynamic };
}

/** Find the initializer of a locally-declared `let`/`const` variable that the
 * `.set(arg)` references. We only look within the same source file — enough
 * to handle `const set = { ... }; db.update(user).set(set)`.
 */
function findLocalInitializer(id: ts.Identifier, source: ts.SourceFile): ts.Expression | null {
  let found: ts.Expression | null = null;
  function visit(node: ts.Node): void {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === id.text
    ) {
      if (node.initializer) {
        found = node.initializer;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

type CallSiteRecord = {
  file: string;
  line: number;
  props: Set<string>;
  dynamic: boolean;
};

async function collectCallSites(): Promise<CallSiteRecord[]> {
  const records: CallSiteRecord[] = [];
  for await (const absPath of walkTsFiles(apiSrc)) {
    const rel = relative(repoRoot, absPath);
    const content = await readFile(absPath, "utf8");
    const source = ts.createSourceFile(
      absPath,
      content,
      ts.ScriptTarget.ES2022,
      /*setParentNodes*/ true,
      ts.ScriptKind.TS,
    );

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && isUserTableUpdate(node)) {
        const owner = resolveUpdateOwner(node, source);
        if (!ownerIsAuthDb(owner)) {
          const setCall = findSetCall(node);
          if (setCall && setCall.arguments.length > 0) {
            const { props, dynamic } = extractSetProps(setCall.arguments[0], source);
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            records.push({ file: rel, line: line + 1, props, dynamic });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return records;
}

describe("migrate-roles invariants", () => {
  it("AUTH_FULL_TABLES includes two_factor (Better Auth twoFactor plugin uses auth_app)", () => {
    expect([...AUTH_FULL_TABLES]).toContain("two_factor");
  });

  it("AUTH_INSERT_TABLES includes domain_events (auth emits user.registered)", () => {
    expect([...AUTH_INSERT_TABLES]).toContain("domain_events");
  });

  it("WORKER_PROVISIONING_TABLES includes legal_entity tables", () => {
    expect([...WORKER_PROVISIONING_TABLES]).toContain("legal_entity");
    expect([...WORKER_PROVISIONING_TABLES]).toContain("legal_entity_member");
  });

  it("WORKER_FULL_TABLES includes marketing_click_ids (purge job + click-id store)", () => {
    expect([...WORKER_FULL_TABLES]).toContain("marketing_click_ids");
  });

  it("WORKER_QR_CODE_SCAN_TABLES includes scan tables (qr-code-scan worker job)", () => {
    expect([...WORKER_QR_CODE_SCAN_TABLES]).toContain("qr_code_scan");
    expect([...WORKER_QR_CODE_SCAN_TABLES]).toContain("qr_code_scan_daily");
  });

  it("WORKER_DATA_EXPORT_TABLES includes data_exports (worker data-export jobs)", () => {
    expect([...WORKER_DATA_EXPORT_TABLES]).toContain("data_exports");
  });
});

describe("api_app user UPDATE grants vs apps/api sources", { timeout: 60_000 }, () => {
  let records: CallSiteRecord[];

  beforeAll(async () => {
    records = await collectCallSites();
  }, 60_000);

  it("every .update(user|userTable).set(...) column maps to API_COLUMN_UPDATE_GRANTS.user", () => {
    const allowed = new Set(API_COLUMN_UPDATE_GRANTS.user);
    const missing = new Map<string, string[]>();
    const dynamicSites: string[] = [];
    const unknownProps = new Map<string, string[]>();

    for (const r of records) {
      if (r.dynamic) dynamicSites.push(`${r.file}:${r.line}`);
      for (const prop of r.props) {
        const col = propToDbColumn(prop);
        if (!col) {
          const arr = unknownProps.get(prop) ?? [];
          arr.push(`${r.file}:${r.line}`);
          unknownProps.set(prop, arr);
          continue;
        }
        if (!allowed.has(col)) {
          const arr = missing.get(col) ?? [];
          arr.push(`${r.file}:${r.line}`);
          missing.set(col, arr);
        }
      }
    }

    const failures: string[] = [];
    if (missing.size > 0) {
      const detail = [...missing.entries()]
        .map(([col, locs]) => `  - ${col} (used at ${locs.join(", ")})`)
        .join("\n");
      failures.push(
        `api_app column UPDATE allow-list missing columns used by apps/api.\nAdd to API_COLUMN_UPDATE_GRANTS.user in migrate-roles.ts:\n${detail}`,
      );
    }
    if (unknownProps.size > 0) {
      const detail = [...unknownProps.entries()]
        .map(([p, locs]) => `  - ${p} (at ${locs.join(", ")})`)
        .join("\n");
      failures.push(
        `Unknown user-table property in .set({...}) — either it isn't on the Drizzle schema or it's a typo:\n${detail}`,
      );
    }
    if (dynamicSites.length > 0) {
      failures.push(
        `Could not statically enumerate columns at these .set(...) sites — refactor to a literal object so the static guard can audit them:\n${dynamicSites
          .map((s) => `  - ${s}`)
          .join("\n")}`,
      );
    }
    if (failures.length > 0) throw new Error(failures.join("\n\n"));
    expect(missing.size).toBe(0);
  });

  it("API_COLUMN_UPDATE_GRANTS.user has no over-granted columns (reverse drift)", () => {
    const observed = new Set<string>();
    for (const r of records) {
      for (const prop of r.props) {
        const col = propToDbColumn(prop);
        if (col) observed.add(col);
      }
    }
    // updated_at is touched by virtually every UPDATE; the audit cannot prove a
    // negative for it because Drizzle may add it implicitly elsewhere. Keep it
    // exempt from reverse-drift; same for any future column that lives in the
    // allow-list intentionally for forward-compat.
    const EXEMPT = new Set<string>(["updated_at"]);
    const unused: string[] = [];
    for (const col of API_COLUMN_UPDATE_GRANTS.user) {
      if (EXEMPT.has(col)) continue;
      if (!observed.has(col)) unused.push(col);
    }
    if (unused.length > 0) {
      throw new Error(
        `API_COLUMN_UPDATE_GRANTS.user contains columns no apps/api code writes anymore — drop them from migrate-roles.ts to keep api_app least-privileged:\n${unused
          .map((c) => `  - ${c}`)
          .join("\n")}`,
      );
    }
    expect(unused).toEqual([]);
  });
});
