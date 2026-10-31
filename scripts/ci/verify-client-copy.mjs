#!/usr/bin/env node
/**
 * Client copy lint: system terms never reach a page a client reads.
 *
 * Scans the user-visible strings (JSX text, string and template literals) of the Bid client
 * workspace for words that name our vendors or internal processes ("Stripe", "KYB", "primary
 * admin") and for US spellings. Imports, type positions, object keys, identifiers, comments,
 * console calls and test files are ignored, so code may keep naming the systems it talks to.
 *
 * A string that must keep a term (a legal notice, a vendor name the law requires) goes in
 * CLIENT_COPY_EXCEPTIONS with the reason it was allowed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/** Folders whose strings a client reads, relative to the repository root. */
export const CLIENT_COPY_ROOTS = [
  "apps/web/src/app/(client)",
  "apps/web/src/components/legal-entity",
  "apps/web/src/components/organisations",
  "apps/web/src/components/dashboard",
  "apps/web/src/components/connect",
  "apps/web/src/components/sections/checkout",
  "apps/web/src/lib/checkout",
  "apps/web/src/lib/presenters",
  "apps/web/src/lib/connect",
];

/** Each forbidden term, with what to say instead. Matched case-insensitively on word boundaries. */
export const FORBIDDEN_CLIENT_TERMS = [
  { term: "KYB", pattern: /\bKYB\b/i, instead: "organisation documents" },
  { term: "KYC", pattern: /\bKYC\b/i, instead: "identity check" },
  { term: "Stripe", pattern: /\bStripe\b/i, instead: "payouts, payout account" },
  { term: "Connect pending", pattern: /\bConnect pending\b/i, instead: "Payouts not set up" },
  { term: "Veriff", pattern: /\bVeriff\b/i, instead: "identity check" },
  { term: "finance review", pattern: /\bfinance review\b/i, instead: "our team checks" },
  { term: "primary admin", pattern: /\bprimary admin\b/i, instead: "owner, Transfer ownership" },
  { term: "2FA", pattern: /\b2FA\b/i, instead: "two-step verification" },
  { term: "Xero", pattern: /\bXero\b/i, instead: "invoice" },
  { term: "favor", pattern: /\bfavor(?:s|ed|ing|ite|ites)?\b/i, instead: "favour (British)" },
  // The workspace menu's names: the page is "Organisation", and the team has its own Team page.
  {
    term: "Organisation settings",
    pattern: /\bOrganisation settings\b/,
    instead: "Organisation (the team is on Team)",
  },
  // Internal process words: clients send works to sell and set a maximum bid.
  { term: "submission", pattern: /\bsubmissions?\b/i, instead: "consignment or work" },
  { term: "voided", pattern: /\bvoided\b/i, instead: "cancelled" },
  {
    term: "Marketing site",
    pattern: /\bmarketing site\b/i,
    instead: "LAX Bid, or the page's name",
  },
  {
    term: "auto-bid",
    pattern: /\bauto[- ]?bid(?:s|der|ders|ding)?\b/i,
    instead: "maximum bid",
  },
  // "Pending" alone says nothing about who is waiting for what; as part of a phrase it may stay.
  {
    term: "pending",
    pattern: /^pending[.:…]?$/i,
    instead: "Waiting for approval, Waiting for an answer",
  },
];

/**
 * Reviewed exceptions: one per file and term, each with the reason it is allowed. Remove an
 * entry as soon as its file no longer needs it; a stale entry fails the lint.
 */
export const CLIENT_COPY_EXCEPTIONS = [
  {
    path: "apps/web/src/lib/presenters/status/compliance.ts",
    term: "Connect pending",
    reason: "Staff status labels for Bid admin; client pages use the organisation label map.",
  },
  {
    path: "apps/web/src/lib/presenters/status/catalog.ts",
    term: "voided",
    reason:
      "Staff lot status labels for Bid admin's lot lists; the public sale board says Withdrawn.",
  },
  {
    path: "apps/web/src/lib/presenters/status/lot-dot-status.ts",
    term: "voided",
    reason: "Staff lot list context only; the sale-board context a client sees says Withdrawn.",
  },
  {
    path: "apps/web/src/lib/presenters/status/finance.ts",
    term: "pending",
    reason: "Staff payment labels; buyers see getPaymentStatusView, which says Awaiting payment.",
  },
  {
    path: "apps/web/src/lib/presenters/status/people.ts",
    term: "pending",
    reason: "Staff invitation and registration labels for the admin status registry.",
  },
];

const TEST_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/;
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(["node_modules", "__tests__", "__mocks__", "dist", ".next"]);

/** A string with no spaces made only of code characters: a key, path, class or token. */
const CODE_TOKEN = /^[\w$./:@#?=&%+-]*$/;

function isCodeToken(text) {
  if (!CODE_TOKEN.test(text)) return false;
  // A single capitalised word ("Stripe") is copy; lowercase or punctuated words are code.
  return text === text.toLowerCase() || /[./:_@#?=&%-]/.test(text);
}

/** Whether a call is `console.*(…)`, whose strings go to logs, never to the page. */
function isConsoleCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "console"
  );
}

/** Whether a literal sits where its text is code, not copy. */
function isNonCopyPosition(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent) || ts.isImportTypeNode(parent)) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  // `require("…")` and `import("…")` name modules.
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression;
    if (callee.kind === ts.SyntaxKind.ImportKeyword) return true;
    if (ts.isIdentifier(callee) && callee.text === "require") return true;
  }
  return false;
}

function insideConsoleCall(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isConsoleCall(current)) return true;
  }
  return false;
}

/** The visible text pieces of a source file, with their line numbers. */
export function collectCopyStrings(sourceText, fileName = "file.tsx") {
  const kind = /\.[cm]?tsx$|\.jsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, kind);
  const pieces = [];
  const push = (node, parts) => {
    const trimmed = parts.join(" … ").replace(/\s+/g, " ").trim();
    if (!trimmed || isCodeToken(parts.join("").trim())) return;
    if (isNonCopyPosition(node) || insideConsoleCall(node)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    pieces.push({ line: line + 1, text: trimmed });
  };
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      push(node, [node.text]);
    } else if (ts.isTemplateExpression(node)) {
      // Interpolations are code; the fixed parts around them are copy.
      push(node, [node.head.text, ...node.templateSpans.map((span) => span.literal.text)]);
    } else if (ts.isJsxText(node)) {
      push(node, [node.text]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pieces;
}

/** Every forbidden term in a file's visible strings. */
export function findForbiddenCopy(sourceText, fileName = "file.tsx") {
  const matches = [];
  for (const piece of collectCopyStrings(sourceText, fileName)) {
    for (const { term, pattern, instead } of FORBIDDEN_CLIENT_TERMS) {
      if (pattern.test(piece.text))
        matches.push({ term, instead, line: piece.line, text: piece.text });
    }
  }
  return matches;
}

/** Whether a repository path is client copy the lint reads. */
export function isClientCopyPath(path) {
  if (!SOURCE_FILE.test(path) || TEST_FILE.test(path) || path.endsWith(".d.ts")) return false;
  if (path.split("/").some((segment) => SKIP_DIRS.has(segment))) return false;
  return CLIENT_COPY_ROOTS.some((root) => path.startsWith(`${root}/`));
}

function listFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * Lints `files` ([path, text] pairs, paths relative to the repository root). Returns the
 * violations and the exceptions that no longer match anything.
 */
export function lintClientCopy(files, exceptions = CLIENT_COPY_EXCEPTIONS) {
  const allowed = new Map(exceptions.map((entry) => [`${entry.path}\0${entry.term}`, entry]));
  const used = new Set();
  const violations = [];
  for (const [path, text] of files) {
    if (!isClientCopyPath(path)) continue;
    for (const match of findForbiddenCopy(text, path)) {
      const key = `${path}\0${match.term}`;
      if (allowed.has(key)) {
        used.add(key);
        continue;
      }
      violations.push({ path, ...match });
    }
  }
  const stale = exceptions.filter((entry) => !used.has(`${entry.path}\0${entry.term}`));
  return { violations, stale };
}

function repositoryFiles() {
  return CLIENT_COPY_ROOTS.flatMap((root) => listFiles(join(repoRoot, root))).map((full) => {
    const path = relative(repoRoot, full).split(sep).join("/");
    return [path, readFileSync(full, "utf8")];
  });
}

function main() {
  const missingReason = CLIENT_COPY_EXCEPTIONS.filter((entry) => !entry.reason?.trim());
  if (missingReason.length > 0) {
    console.error("Client copy exceptions need a reason:");
    for (const entry of missingReason) console.error(`  ${entry.path} (${entry.term})`);
    process.exit(1);
  }
  const { violations, stale } = lintClientCopy(repositoryFiles());
  for (const v of violations) {
    console.error(`${v.path}:${v.line}: "${v.term}" in client copy (say ${v.instead}): ${v.text}`);
  }
  for (const entry of stale) {
    console.error(`Stale client copy exception: ${entry.path} (${entry.term}); remove it.`);
  }
  if (violations.length > 0 || stale.length > 0) process.exit(1);
  console.log("client copy lint passed");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
