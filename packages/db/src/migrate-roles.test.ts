import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import {
  API_ACCOUNTING_COPY_READ_TABLES,
  API_ACCOUNTING_HISTORY_TABLES,
  API_ACCOUNTING_READ_TABLES,
  API_ACCOUNTING_REQUEUE_COLUMNS,
  API_ACCOUNTING_REQUEUE_TABLES,
  API_ACCOUNTING_SETTING_TABLES,
  API_DENY_TABLES,
  API_PAYMENT_REFUND_TABLES,
  API_PAYMENT_TRANSFER_REFERENCE_TABLES,
  API_PRIVATE_SALE_ARTWORK_HISTORY_TABLES,
  API_READ_TABLES,
  API_REFUND_REVERSAL_TABLES,
  AUTH_ADDRESS_TABLES,
  AUTH_EXPORT_AUDIT_TABLES,
  AUTH_EXPORT_TABLES,
  AUTH_FULL_TABLES,
  AUTH_INSERT_SELECT_TABLES,
  AUTH_LEGAL_ACCEPTANCE_TABLES,
  AUTH_POLICY_TABLES,
  AUTH_READ_TABLES,
  FINANCE_SETTING_READ_TABLES,
  LIFT_ZOHO_CAMPAIGNS_OPT_OUT_ROLES,
  SELLER_TERMS_INSERT_SELECT_TABLES,
  SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS,
  SHOP_ARTWORK_REGISTER_CONFLICT_TABLES,
  SHOP_ARTWORK_REGISTER_EVENT_TABLES,
  SHOP_ARTWORK_REGISTER_OFFER_TABLES,
  SHOP_ARTWORK_REGISTER_READ_TABLES,
  SHOP_COMMERCE_APPEND_ONLY_TABLES,
  SHOP_COMMERCE_TABLES,
  SHOP_SUBJECT_EXPORT_READ_TABLES,
  WORKER_ACCOUNTING_APPEND_ONLY_TABLES,
  WORKER_ACCOUNTING_COPY_TABLES,
  WORKER_ACCOUNTING_COPY_UPDATE_COLUMNS,
  WORKER_ACCOUNTING_DOCUMENT_TABLES,
  WORKER_ACCOUNTING_DOCUMENT_UPDATE_COLUMNS,
  WORKER_ACCOUNTING_READ_TABLES,
  WORKER_ANONYMISATION_DELETE_TABLES,
  WORKER_ARTWORK_REGISTER_APPEND_ONLY_TABLES,
  WORKER_ARTWORK_REGISTER_TABLES,
  WORKER_BID_ALERT_PRUNE_DELETE_TABLES,
  WORKER_BID_ALERT_TABLES,
  WORKER_COLLECTION_BOOKING_ERASURE_COLUMNS,
  WORKER_COLLECTION_LOT_RELEASE_COLUMNS,
  WORKER_DATA_EXPORT_TABLES,
  WORKER_DENY_TABLES,
  WORKER_DOMAIN_EVENT_DELIVERY_TABLES,
  WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS,
  WORKER_EXPORT_CATEGORY_READ_TABLES,
  WORKER_FULL_TABLES,
  WORKER_INVOICE_RAISE_FULFILMENT_TABLES,
  WORKER_INVOICE_RAISE_INSERT_TABLES,
  WORKER_KYC_RETENTION_DEAL_READ_TABLES,
  WORKER_KYC_RETENTION_PURGE_TABLES,
  WORKER_KYC_RETENTION_TOMBSTONE_TABLES,
  WORKER_LIFECYCLE_READ_TABLES,
  WORKER_NOTIFICATION_OUTBOX_TABLES,
  WORKER_PAYMENT_MAINTENANCE_TABLES,
  WORKER_PAYMENT_REFUND_TABLES,
  WORKER_PRODUCT_PROFILE_TABLES,
  WORKER_PROVISIONING_TABLES,
  WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES,
  WORKER_QR_CODE_SCAN_TABLES,
  WORKER_READ_TABLES,
  WORKER_REOFFER_TABLES,
  WORKER_SELLER_TERMS_READ_COLUMNS,
  WORKER_SHOP_ENQUIRY_READ_COLUMNS,
  WORKER_SHOP_ORDER_READ_COLUMNS,
  WORKER_SHOP_PRINT_GROUP_READ_COLUMNS,
  WORKER_ZOHO_ARTWORK_SYNC_TABLES,
  WORKER_ZOHO_CAMPAIGNS_LIFT_READ_TABLES,
  WORKER_ZOHO_CAMPAIGNS_SUPPRESSION_TABLES,
} from "./migrate-roles.js";
import * as schema from "./schema/index.js";

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
const persistenceSrc = join(repoRoot, "packages/persistence/src");
const apiRuntimeRoots = [apiSrc, persistenceSrc];

const USER_TABLE_IDENTIFIERS = new Set(["user", "userTable"]);

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
  for (const root of apiRuntimeRoots) {
    for await (const absPath of walkTsFiles(root)) {
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
  }
  return records;
}

describe("migrate-roles invariants", () => {
  it("grants append-only access to identity_lifecycle_outbox", () => {
    expect([...AUTH_INSERT_SELECT_TABLES]).toContain("identity_lifecycle_outbox");
    expect([...AUTH_FULL_TABLES]).not.toContain("identity_lifecycle_outbox");
  });

  it("lets auth_app read access markers and manage 2FA policy while denying api_app both", () => {
    expect([...AUTH_READ_TABLES]).toEqual(["identity_access_marker"]);
    expect([...AUTH_POLICY_TABLES]).toEqual(["identity_mfa_policy"]);
    for (const table of [...AUTH_READ_TABLES, ...AUTH_POLICY_TABLES]) {
      expect([...API_DENY_TABLES]).toContain(table);
      expect([...AUTH_FULL_TABLES]).not.toContain(table);
    }
  });

  it("gives auth_app the address book and keeps api_app away from it", () => {
    expect([...AUTH_ADDRESS_TABLES]).toEqual(["identity_address"]);
    expect([...API_DENY_TABLES]).toContain("identity_address");
    expect([...AUTH_FULL_TABLES]).not.toContain("identity_address");
  });

  it("gives auth_app the data export requests, with an append-only audit trail, and denies api_app", () => {
    expect([...AUTH_EXPORT_TABLES]).toEqual(["subject_data_export", "subject_data_request"]);
    expect([...AUTH_EXPORT_AUDIT_TABLES]).toEqual([
      "subject_data_export_audit",
      "subject_data_request_audit",
    ]);
    for (const table of [...AUTH_EXPORT_TABLES, ...AUTH_EXPORT_AUDIT_TABLES]) {
      expect([...API_DENY_TABLES]).toContain(table);
      expect([...WORKER_DENY_TABLES]).toContain(table);
      expect([...AUTH_FULL_TABLES]).not.toContain(table);
    }
  });

  it("lets auth_app add and read sign-up acceptances only, and denies api_app and worker_app", () => {
    expect([...AUTH_LEGAL_ACCEPTANCE_TABLES]).toEqual(["subject_legal_acceptance"]);
    for (const table of AUTH_LEGAL_ACCEPTANCE_TABLES) {
      expect([...API_DENY_TABLES]).toContain(table);
      expect([...WORKER_DENY_TABLES]).toContain(table);
      expect([...AUTH_FULL_TABLES]).not.toContain(table);
    }
  });

  it("AUTH_FULL_TABLES includes two_factor (Better Auth twoFactor plugin uses auth_app)", () => {
    expect([...AUTH_FULL_TABLES]).toContain("two_factor");
  });

  it("keeps passkeys with the issuer alone: auth_app has them, api_app and worker_app do not", () => {
    expect([...AUTH_FULL_TABLES]).toContain("passkey");
    expect([...API_DENY_TABLES]).toContain("passkey");
    expect([...WORKER_DENY_TABLES]).toContain("passkey");
  });

  it("WORKER_READ_TABLES includes identity_lifecycle_outbox (outbox relay job)", () => {
    expect([...WORKER_READ_TABLES]).toContain("identity_lifecycle_outbox");
  });

  it("the worker reads collection hours, rules and bookings but never writes them", () => {
    const tables = [
      "collection_place",
      "collection_weekly_hours",
      "collection_exception",
      "collection_booking",
      "collection_booking_lot",
    ];
    for (const table of tables) {
      expect([...WORKER_READ_TABLES]).toContain(table);
      expect([...WORKER_FULL_TABLES]).not.toContain(table);
      expect([...API_DENY_TABLES]).not.toContain(table);
      expect([...API_READ_TABLES]).not.toContain(table);
    }
  });

  it("lets the worker change only the columns erasure needs on a booking and its lots", async () => {
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    expect([...WORKER_COLLECTION_BOOKING_ERASURE_COLUMNS].sort()).toEqual(
      [
        "status",
        "cancelled_at",
        "ics_sequence",
        "updated_at",
        "collector_name",
        "collector_email",
        "collector_company",
        "id_check_type",
        "personal_details_erased_at",
        "handover_record_cleared_at",
      ].sort(),
    );
    // Never the place, the time, the lots chosen, who booked, or the idempotency record.
    for (const column of [
      "slot_start",
      "seat",
      "legal_entity_id",
      "booked_by_user_id",
      "idempotency_key",
      "request_fingerprint",
      "reference",
    ]) {
      expect([...WORKER_COLLECTION_BOOKING_ERASURE_COLUMNS]).not.toContain(column);
    }
    expect([...WORKER_COLLECTION_LOT_RELEASE_COLUMNS]).toEqual(["active"]);
    expect(source).toContain(
      '"collection_booking",\n          WORKER_COLLECTION_BOOKING_ERASURE_COLUMNS,',
    );
    expect(source).toContain(
      '"collection_booking_lot",\n          WORKER_COLLECTION_LOT_RELEASE_COLUMNS,',
    );
  });

  it("denies api_app and worker_app on shop append-only commerce tables", () => {
    for (const table of SHOP_COMMERCE_APPEND_ONLY_TABLES) {
      expect([...API_DENY_TABLES]).toContain(table);
      expect([...WORKER_DENY_TABLES]).toContain(table);
    }
  });

  it("grants shop_app full DML on shop commerce tables including identity merge inbox", () => {
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_identity_merge_inbox");
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_admin_command");
  });

  it("keeps the Shop's delivery regions to shop_app, denied to the Bid API and the worker", () => {
    for (const table of [
      "shop_delivery_region",
      "shop_delivery_restricted_country",
      "shop_delivery_quote",
    ]) {
      expect([...SHOP_COMMERCE_TABLES]).toContain(table);
      expect([...API_DENY_TABLES]).toContain(table);
      expect([...WORKER_DENY_TABLES]).toContain(table);
    }
  });

  it("keeps the Shop home cover to shop_app, denied to the Bid API and the worker", () => {
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_home_cover");
    expect([...API_DENY_TABLES]).toContain("shop_home_cover");
    expect([...WORKER_DENY_TABLES]).toContain("shop_home_cover");
  });

  it("gives shop_app the print-facts tables, and keeps them from api_app and the worker", () => {
    for (const table of ["shop_edition_facts", "shop_print_exception"]) {
      expect([...SHOP_COMMERCE_TABLES]).toContain(table);
      expect([...API_DENY_TABLES]).toContain(table);
      expect([...WORKER_DENY_TABLES]).toContain(table);
    }
  });

  it("lets the worker read lot categories, which every lot read loads", () => {
    expect([...WORKER_READ_TABLES]).toContain("lot_categories");
  });

  it("keeps the printers and publishers list to shop_app, denied to the Bid API and the worker", () => {
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_print_party");
    expect([...API_DENY_TABLES]).toContain("shop_print_party");
    expect([...WORKER_DENY_TABLES]).toContain("shop_print_party");
  });

  it("keeps each tool's saved views to its own role", () => {
    // LAX Admin's views belong to shop_app alone.
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_staff_saved_view");
    expect([...API_DENY_TABLES]).toContain("shop_staff_saved_view");
    expect([...WORKER_DENY_TABLES]).toContain("shop_staff_saved_view");
    // Bid admin's views belong to api_app alone: it is granted by default and never listed for
    // Shop or the worker.
    expect([...API_DENY_TABLES]).not.toContain("admin_saved_view");
    expect([...SHOP_COMMERCE_TABLES]).not.toContain("admin_saved_view");
    expect([...WORKER_FULL_TABLES, ...WORKER_READ_TABLES]).not.toContain("admin_saved_view");
  });

  it("grants public sequence usage to shop_app (sale authority grant revision)", async () => {
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    expect(source).toMatch(/\["auth_app", "api_app", "shop_app", "worker_app"\].*grantSequences/s);
  });

  it("models the post-0160 Identity directory cutover", () => {
    expect([...API_READ_TABLES]).toContain("bid_identity_directory");
    expect([...WORKER_PRODUCT_PROFILE_TABLES]).toContain("bid_identity_directory");
    expect([...WORKER_READ_TABLES]).not.toContain("user");
    expect([...WORKER_DENY_TABLES]).toContain("user");
  });

  it("WORKER_PROVISIONING_TABLES includes legal_entity tables", () => {
    expect([...WORKER_PROVISIONING_TABLES]).toContain("legal_entity");
    expect([...WORKER_PROVISIONING_TABLES]).toContain("legal_entity_member");
  });

  it("lets the KYC retention purge read and delete only the records it purges", () => {
    expect([...WORKER_KYC_RETENTION_PURGE_TABLES].sort()).toEqual([
      "admin_review_task",
      "kyc_verification",
      "kyc_watchlist_screening",
      "legal_entity_document",
      "source_of_funds",
      "source_of_funds_document",
    ]);
    for (const table of WORKER_KYC_RETENTION_PURGE_TABLES) {
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
    }
  });

  it("keeps the retention tombstone append-only for the worker", async () => {
    expect([...WORKER_KYC_RETENTION_TOMBSTONE_TABLES]).toEqual(["kyc_retention_tombstone"]);
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    const grant = source.match(
      /for \(const tableName of WORKER_KYC_RETENTION_TOMBSTONE_TABLES\) \{\s*await grantIfExists\(client, "worker_app", tableName, "([^"]+)"\)/,
    );
    expect(grant?.[1]).toBe("INSERT, SELECT");
  });

  it("WORKER_FULL_TABLES includes marketing_click_ids (purge job + click-id store)", () => {
    expect([...WORKER_FULL_TABLES]).toContain("marketing_click_ids");
  });

  it("WORKER_FULL_TABLES includes marketing_attribution (retention purge)", () => {
    expect([...WORKER_FULL_TABLES]).toContain("marketing_attribution");
  });

  it("WORKER_FULL_TABLES includes media_asset (process-image + image-cleanup)", () => {
    expect([...WORKER_FULL_TABLES]).toContain("media_asset");
  });

  it("lets the worker read and write the Bid alert tables, deleting only through the anonymisation list", () => {
    expect([...WORKER_BID_ALERT_TABLES].sort()).toEqual([
      "bid_alert_announcement",
      "bid_alert_digest",
      "bid_alert_match",
      "bid_alert_subscriber",
      "bid_alert_topic",
    ]);
    for (const table of WORKER_BID_ALERT_TABLES) {
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
    }
  });

  it("lets the worker delete only Bid's alert logs and topics for the retention prune, never announcements", () => {
    expect([...WORKER_BID_ALERT_PRUNE_DELETE_TABLES].sort()).toEqual([
      "bid_alert_digest",
      "bid_alert_match",
      "bid_alert_topic",
    ]);
    expect([...WORKER_BID_ALERT_PRUNE_DELETE_TABLES]).not.toContain("bid_alert_announcement");
    for (const table of WORKER_BID_ALERT_PRUNE_DELETE_TABLES) {
      expect([...WORKER_BID_ALERT_TABLES]).toContain(table);
    }
  });

  it("lets the worker read the Shop enquiry columns the Lead needs, and no whole Shop table", () => {
    const columns = Object.fromEntries(WORKER_SHOP_ENQUIRY_READ_COLUMNS);
    expect(Object.keys(columns).sort()).toEqual(["shop_artwork", "shop_artwork_interest"]);
    expect([...columns.shop_artwork].sort()).toEqual(["id", "slug", "title"]);
    expect([...columns.shop_artwork_interest].sort()).toEqual([
      "artwork_id",
      "contact_phone",
      "identity_subject_id",
      "intent",
      "reference",
    ]);
    // Column grants only: both tables stay in the deny list and in no whole-table worker list.
    for (const table of Object.keys(columns)) {
      expect([...WORKER_DENY_TABLES]).toContain(table);
    }
  });

  it("lets the worker read the Shop columns a print group needs, and no whole Shop table", () => {
    const columns = Object.fromEntries(WORKER_SHOP_PRINT_GROUP_READ_COLUMNS);
    expect(Object.keys(columns).sort()).toEqual(["shop_artwork", "shop_edition"]);
    expect([...columns.shop_edition].sort()).toEqual(["allocation", "artwork_id", "proof_number"]);
    for (const personal of ["print_price_pence", "description", "import_key"]) {
      expect(columns.shop_artwork).not.toContain(personal);
    }
    for (const table of Object.keys(columns)) {
      expect([...WORKER_DENY_TABLES]).toContain(table);
    }
  });

  it("lets the worker read the Shop order columns the Deal name needs, and no whole Shop table", () => {
    const columns = Object.fromEntries(WORKER_SHOP_ORDER_READ_COLUMNS);
    expect(Object.keys(columns).sort()).toEqual([
      "shop_guest_customer",
      "shop_order",
      "shop_order_line",
    ]);
    expect([...columns.shop_order].sort()).toEqual([
      "delivery_recipient_name",
      "guest_customer_id",
      "id",
      "reference",
    ]);
    expect([...columns.shop_order_line].sort()).toEqual([
      "artwork_id",
      "created_at",
      "id",
      "order_id",
    ]);
    expect([...columns.shop_guest_customer].sort()).toEqual(["id", "name"]);
    for (const table of Object.keys(columns)) {
      expect([...WORKER_DENY_TABLES]).toContain(table);
    }
  });

  it("lets the worker erase email-only alert subscribers, and only those, on purge", () => {
    // eraseAlertSubscribers deletes from both tables; topics, matches and digests go by cascade.
    expect([...WORKER_ANONYMISATION_DELETE_TABLES]).toContain("bid_alert_subscriber");
    expect([...WORKER_ANONYMISATION_DELETE_TABLES]).toContain("visitor_sale_alert_subscriber");
    for (const table of [
      "bid_alert_topic",
      "bid_alert_match",
      "bid_alert_digest",
      "bid_alert_announcement",
    ]) {
      expect([...WORKER_ANONYMISATION_DELETE_TABLES]).not.toContain(table);
    }
    expect([...WORKER_DENY_TABLES]).not.toContain("visitor_sale_alert_subscriber");
  });

  it("lets the worker maintain the artwork register but only append to its history", () => {
    expect([...WORKER_ARTWORK_REGISTER_TABLES].sort()).toEqual([
      "artwork_register",
      "artwork_register_conflict",
    ]);
    expect([...WORKER_ARTWORK_REGISTER_APPEND_ONLY_TABLES]).toEqual(["artwork_register_event"]);
    for (const table of [
      ...WORKER_ARTWORK_REGISTER_TABLES,
      ...WORKER_ARTWORK_REGISTER_APPEND_ONLY_TABLES,
    ]) {
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
    }
  });

  it("lets LAX Admin read the artwork register and only decide conflicts, never change records", () => {
    expect([...SHOP_ARTWORK_REGISTER_READ_TABLES].sort()).toEqual([
      "artwork_register",
      "zoho_artwork_sync_outcome",
      "zoho_listing_sync_run",
      "zoho_sync_health",
    ]);
    expect([...SHOP_ARTWORK_REGISTER_CONFLICT_TABLES]).toEqual(["artwork_register_conflict"]);
    expect([...SHOP_ARTWORK_REGISTER_EVENT_TABLES]).toEqual(["artwork_register_event"]);
    // The records themselves and the sync results are read-only for LAX Admin.
    for (const table of SHOP_ARTWORK_REGISTER_READ_TABLES) {
      expect([...SHOP_ARTWORK_REGISTER_CONFLICT_TABLES]).not.toContain(table);
      expect([...SHOP_ARTWORK_REGISTER_EVENT_TABLES]).not.toContain(table);
    }
    expect([...WORKER_DENY_TABLES]).not.toContain("artwork_register");
  });

  it("lets Shop read the shared mail tables its data export needs, and nothing more", () => {
    expect([...SHOP_SUBJECT_EXPORT_READ_TABLES].sort()).toEqual([
      "email_suppression",
      "newsletter_signup_log",
    ]);
  });

  it("lets Shop move an original's offer through the register", () => {
    expect([...SHOP_ARTWORK_REGISTER_OFFER_TABLES]).toEqual(["artwork_register"]);
  });

  it("lets the worker keep the Zoho artwork sync watermark and per-Product results", () => {
    expect([...WORKER_ZOHO_ARTWORK_SYNC_TABLES].sort()).toEqual([
      "zoho_artwork_sync_outcome",
      "zoho_artwork_sync_state",
      "zoho_listing_sync_run",
      "zoho_sync_health",
    ]);
    for (const table of WORKER_ZOHO_ARTWORK_SYNC_TABLES) {
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
    }
  });

  it("lets the worker keep the Zoho Campaigns suppression watermark and update suppressions", async () => {
    expect([...WORKER_ZOHO_CAMPAIGNS_SUPPRESSION_TABLES]).toEqual([
      "zoho_campaigns_suppression_state",
    ]);
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    // UPDATE on email_suppression is column-level: reason, source and created_at, never the key.
    expect([...WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS]).toEqual([
      "reason",
      "source",
      "created_at",
    ]);
    expect(source).toContain('"worker_app", "email_suppression", "INSERT, SELECT");');
    expect(source).not.toContain('"worker_app", "email_suppression", "INSERT, SELECT, UPDATE"');
    expect(source).toContain("WORKER_EMAIL_SUPPRESSION_UPDATE_COLUMNS,");
    // A lift is written by one definer function; the worker reads the record and holds no DELETE.
    expect([...WORKER_ZOHO_CAMPAIGNS_LIFT_READ_TABLES]).toEqual(["zoho_campaigns_optout_lift"]);
    expect([...LIFT_ZOHO_CAMPAIGNS_OPT_OUT_ROLES]).toEqual(["api_app", "worker_app"]);
    expect(source).toContain(
      'grantIfExists(client, "worker_app", tableName, "SELECT");\n        }\n        for (const role of LIFT_ZOHO_CAMPAIGNS_OPT_OUT_ROLES)',
    );
    expect(source).not.toMatch(/"(?:shop_app|worker_app)", "email_suppression", "[^"]*DELETE/);
  });

  it("WORKER_QR_CODE_SCAN_TABLES includes scan tables (qr-code-scan worker job)", () => {
    expect([...WORKER_QR_CODE_SCAN_TABLES]).toContain("qr_code_scan");
    expect([...WORKER_QR_CODE_SCAN_TABLES]).toContain("qr_code_scan_daily");
  });

  it("lets the worker purge raw QR scans but never the daily roll-up", async () => {
    expect([...WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES]).toEqual(["qr_code_scan"]);
    for (const table of WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES) {
      expect([...WORKER_QR_CODE_SCAN_TABLES]).toContain(table);
    }
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    expect(source).toContain("WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES");
    expect(source).toMatch(
      /for \(const tableName of WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES\) \{\s+await grantIfExists\(client, "worker_app", tableName, "SELECT, DELETE"\);/,
    );
  });

  it("lets the retention purge read the private sale deal records it holds back on, and only read them", async () => {
    expect([...WORKER_KYC_RETENTION_DEAL_READ_TABLES].sort()).toEqual([
      "private_sale_deal_party",
      "private_sale_deal_party_history",
      "private_sale_deal_stage_history",
    ]);
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    expect(source).toMatch(
      /for \(const tableName of WORKER_KYC_RETENTION_DEAL_READ_TABLES\) \{\s+await grantIfExists\(client, "worker_app", tableName, "SELECT"\);/,
    );
  });

  it("lets the export jobs read the sale and submission category tables, and only read them", async () => {
    expect([...WORKER_EXPORT_CATEGORY_READ_TABLES].sort()).toEqual([
      "sale_categories",
      "submission_categories",
    ]);
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    expect(source).toMatch(
      /for \(const tableName of WORKER_EXPORT_CATEGORY_READ_TABLES\) \{\s+await grantIfExists\(client, "worker_app", tableName, "SELECT"\);/,
    );
  });

  it("WORKER_DATA_EXPORT_TABLES includes data_exports (worker data-export jobs)", () => {
    expect([...WORKER_DATA_EXPORT_TABLES]).toContain("data_exports");
  });

  it("WORKER_DOMAIN_EVENT_DELIVERY_TABLES includes domain_event_delivery ledger", () => {
    expect([...WORKER_DOMAIN_EVENT_DELIVERY_TABLES]).toContain("domain_event_delivery");
  });

  it("the worker may raise an invoice: payment, source of funds and fulfilment, no deletes", () => {
    expect([...WORKER_INVOICE_RAISE_INSERT_TABLES]).toEqual([
      "payment",
      "source_of_funds",
      "bid_invoice",
      "bid_invoice_line",
    ]);
    expect([...WORKER_INVOICE_RAISE_FULFILMENT_TABLES]).toEqual(["lot_fulfilment"]);
  });

  it("lets the worker update re-offers and seller answers but never create or delete one", () => {
    expect([...WORKER_REOFFER_TABLES]).toEqual(["lot_reoffer", "seller_consent"]);
    for (const table of WORKER_REOFFER_TABLES) {
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
      expect([...WORKER_FULL_TABLES]).not.toContain(table);
      expect([...API_DENY_TABLES]).not.toContain(table);
    }
  });

  it("keeps buyer refunds append-only for the Bid API and the reconcile job, and away from Shop", () => {
    expect([...API_PAYMENT_REFUND_TABLES]).toEqual(["payment_refund"]);
    expect([...WORKER_PAYMENT_REFUND_TABLES]).toEqual(["payment_refund"]);
    expect([...API_DENY_TABLES]).not.toContain("payment_refund");
    expect([...WORKER_DENY_TABLES]).not.toContain("payment_refund");
    expect([...WORKER_FULL_TABLES]).not.toContain("payment_refund");
    expect([...SHOP_COMMERCE_TABLES, ...SHOP_COMMERCE_APPEND_ONLY_TABLES]).not.toContain(
      "payment_refund",
    );
  });

  it("keeps a deal's artwork history append-only for the Bid API: insert and select, nothing else", async () => {
    expect([...API_PRIVATE_SALE_ARTWORK_HISTORY_TABLES]).toEqual([
      "private_sale_deal_artwork_history",
    ]);
    expect([...API_DENY_TABLES]).not.toContain("private_sale_deal_artwork_history");
    const source = await readFile(join(__dirname, "migrate-roles.ts"), "utf8");
    expect(source).toMatch(
      /API_PRIVATE_SALE_ARTWORK_HISTORY_TABLES as readonly string\[\]\)\.includes\(tableName\)\) \{\s+await grantIfExists\(client, "api_app", tableName, "INSERT, SELECT"\);/,
    );
  });

  it("keeps the bank-transfer references append-only for the Bid API and away from every other role", () => {
    expect([...API_PAYMENT_TRANSFER_REFERENCE_TABLES]).toEqual(["payment_transfer_reference"]);
    expect([...API_DENY_TABLES]).not.toContain("payment_transfer_reference");
    expect([...WORKER_FULL_TABLES]).not.toContain("payment_transfer_reference");
    expect([...WORKER_READ_TABLES]).not.toContain("payment_transfer_reference");
  });

  it("keeps refund reversals append-only for the Bid API and away from every other role", () => {
    expect([...API_REFUND_REVERSAL_TABLES]).toEqual(["stripe_refund_reversal"]);
    expect([...API_DENY_TABLES]).not.toContain("stripe_refund_reversal");
    expect([...WORKER_FULL_TABLES]).not.toContain("stripe_refund_reversal");
    expect([...WORKER_READ_TABLES]).not.toContain("stripe_refund_reversal");
  });

  it("keeps accounting history append-only, lets the Bid API requeue by state columns only, and keeps Shop away", () => {
    expect([...API_ACCOUNTING_REQUEUE_TABLES]).toEqual(["accounting_document"]);
    expect([...API_ACCOUNTING_HISTORY_TABLES]).toEqual(["accounting_document_event"]);
    expect(API_ACCOUNTING_REQUEUE_COLUMNS).not.toContain("provider");
    expect(API_ACCOUNTING_REQUEUE_COLUMNS).toContain("state");
    for (const column of API_ACCOUNTING_REQUEUE_COLUMNS) {
      expect(WORKER_ACCOUNTING_DOCUMENT_UPDATE_COLUMNS).toContain(column);
    }
    expect([...API_ACCOUNTING_READ_TABLES].sort()).toEqual([
      "accounting_document",
      "accounting_document_event",
    ]);
    expect([...API_ACCOUNTING_SETTING_TABLES]).toEqual(["accounting_source_setting"]);
    expect([...WORKER_ACCOUNTING_DOCUMENT_TABLES]).toEqual(["accounting_document"]);
    expect([...WORKER_ACCOUNTING_APPEND_ONLY_TABLES]).toEqual(["accounting_document_event"]);
    expect([...WORKER_ACCOUNTING_READ_TABLES]).toEqual(["accounting_source_setting"]);
    // Stored copies: the worker records them and notes the email once; the API only reads them.
    expect([...WORKER_ACCOUNTING_COPY_TABLES]).toEqual(["accounting_document_copy"]);
    expect([...WORKER_ACCOUNTING_COPY_UPDATE_COLUMNS].sort()).toEqual([
      "email_outbox_id",
      "email_queued_at",
    ]);
    expect([...API_ACCOUNTING_COPY_READ_TABLES]).toEqual(["accounting_document_copy"]);
    const accounting = [
      ...API_ACCOUNTING_READ_TABLES,
      ...API_ACCOUNTING_SETTING_TABLES,
      ...API_ACCOUNTING_COPY_READ_TABLES,
    ] as string[];
    // The worker's lists carry no broader grant for these tables, and no role list denies the pair
    // that must stay reachable.
    for (const table of accounting) {
      expect([...WORKER_FULL_TABLES]).not.toContain(table);
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
      expect([...WORKER_READ_TABLES]).not.toContain(table);
      expect([...SHOP_COMMERCE_TABLES, ...SHOP_COMMERCE_APPEND_ONLY_TABLES]).not.toContain(table);
      expect([...API_DENY_TABLES]).not.toContain(table);
    }
  });

  it("lets the API and the worker add seller terms and re-price a held one, and keeps both away from Shop", () => {
    expect([...SELLER_TERMS_INSERT_SELECT_TABLES]).toEqual(["sale_seller_terms"]);
    // Re-pricing writes the figures and how they were made, never what the row is for, nor the
    // hammer, premium and old-rule fee fixed when the invoice was raised.
    for (const fixed of [
      "id",
      "payment_id",
      "lot_id",
      "seller_legal_entity_id",
      "hammer_pence",
      "premium_pence",
      "legacy_platform_fee_pence",
    ]) {
      expect([...SELLER_TERMS_RECOMPUTE_UPDATE_COLUMNS]).not.toContain(fixed);
    }
    expect([...FINANCE_SETTING_READ_TABLES]).toEqual(["bid_finance_setting"]);
    // The worker reads only the agreement columns the rule needs, never the whole table.
    expect([...WORKER_READ_TABLES]).not.toContain("consignment_agreement");
    expect(Object.fromEntries(WORKER_SELLER_TERMS_READ_COLUMNS)).toEqual({
      consignment_agreement: [
        "id",
        "submission_id",
        "legal_entity_id",
        "accepted_at",
        "proposed_at",
        "commission_percent",
      ],
    });
    for (const table of [...SELLER_TERMS_INSERT_SELECT_TABLES, ...FINANCE_SETTING_READ_TABLES]) {
      expect([...WORKER_FULL_TABLES]).not.toContain(table);
      expect([...WORKER_DENY_TABLES]).not.toContain(table);
      expect([...WORKER_READ_TABLES]).not.toContain(table);
      expect([...API_DENY_TABLES]).not.toContain(table);
      expect([...SHOP_COMMERCE_TABLES, ...SHOP_COMMERCE_APPEND_ONLY_TABLES]).not.toContain(table);
    }
  });

  it("WORKER_PAYMENT_MAINTENANCE_TABLES includes payment (expire-stale-payments)", () => {
    expect([...WORKER_PAYMENT_MAINTENANCE_TABLES]).toContain("payment");
  });

  it("WORKER_NOTIFICATION_OUTBOX_TABLES includes notification_outbox (lifecycle staging)", () => {
    expect([...WORKER_NOTIFICATION_OUTBOX_TABLES]).toContain("notification_outbox");
  });

  it("WORKER_LIFECYCLE_READ_TABLES includes watchlist and saleroom_session", () => {
    expect([...WORKER_LIFECYCLE_READ_TABLES]).toContain("watchlist");
    expect([...WORKER_LIFECYCLE_READ_TABLES]).toContain("saleroom_session");
  });
});

describe("api_app grants vs API runtime sources", { timeout: 60_000 }, () => {
  let records: CallSiteRecord[];

  beforeAll(async () => {
    records = await collectCallSites();
  }, 60_000);

  it("forbids direct Identity-owned user updates from API and persistence runtime", () => {
    expect(
      records.map((record) => `${record.file}:${record.line}`),
      "direct user update call sites",
    ).toEqual([]);
  });

  it("forbids direct Identity-table access from API and persistence runtime", async () => {
    const forbiddenImports: string[] = [];
    const forbiddenTables = new Set([
      "account",
      "session",
      "verification",
      "twoFactor",
      "oauthAccessToken",
      "oauthConsent",
      "jwksKey",
    ]);
    for (const root of apiRuntimeRoots) {
      for await (const absPath of walkTsFiles(root)) {
        const source = ts.createSourceFile(
          absPath,
          await readFile(absPath, "utf8"),
          ts.ScriptTarget.ES2022,
          true,
          ts.ScriptKind.TS,
        );
        for (const statement of source.statements) {
          if (
            !ts.isImportDeclaration(statement) ||
            statement.moduleSpecifier.getText(source).replaceAll(/['"]/g, "") !==
              "@auction/db/schema"
          ) {
            continue;
          }
          const bindings = statement.importClause?.namedBindings;
          if (!bindings || !ts.isNamedImports(bindings)) continue;
          for (const element of bindings.elements) {
            if (forbiddenTables.has(element.propertyName?.text ?? element.name.text)) {
              forbiddenImports.push(
                `${relative(repoRoot, absPath)}:${source.getLineAndCharacterOfPosition(element.getStart(source)).line + 1}`,
              );
            }
          }
        }
      }
    }
    expect(forbiddenImports, "direct Identity table imports").toEqual([]);
  });
});

/**
 * Every table a worker purge repository deletes from must be one worker_app may delete from.
 * Without the grant the nightly job fails with `permission denied` and nothing is ever purged.
 */
describe("worker purge repositories hold a DELETE grant", () => {
  const workerRepositories = join(repoRoot, "apps/worker/src/repositories");
  const workerDeleteTables = new Set<string>([
    ...WORKER_FULL_TABLES,
    ...WORKER_QR_CODE_SCAN_PURGE_DELETE_TABLES,
    ...WORKER_KYC_RETENTION_PURGE_TABLES,
  ]);
  const tableNameByIdentifier = new Map(
    Object.entries(schema)
      .filter((entry): entry is [string, PgTable] => is(entry[1], PgTable))
      .map(([identifier, table]) => [identifier, getTableName(table)]),
  );

  async function deletedTables(file: string): Promise<string[]> {
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const tables: string[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "delete" &&
        node.arguments[0] &&
        ts.isIdentifier(node.arguments[0])
      ) {
        const table = tableNameByIdentifier.get(node.arguments[0].text);
        if (table) tables.push(table);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return tables;
  }

  it("covers every table the purge repositories delete from", async () => {
    const files = (await readdir(workerRepositories))
      .filter((name) => /purge.*\.repository\.ts$/.test(name))
      .map((name) => join(workerRepositories, name));
    expect(files.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const file of files) {
      const tables = await deletedTables(file);
      expect(tables.length, `${relative(repoRoot, file)} deletes nothing`).toBeGreaterThan(0);
      for (const table of tables) {
        if (!workerDeleteTables.has(table)) missing.push(`${relative(repoRoot, file)}: ${table}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
