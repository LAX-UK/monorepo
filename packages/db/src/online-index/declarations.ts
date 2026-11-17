import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Online index declarations: `packages/db/drizzle/online/<migration tag>.sql`.
 *
 * A declaration lists the indexes a migration creates, written as
 * `CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS ...` statements separated by
 * `--> statement-breakpoint` lines. The production migrate builds them outside any
 * transaction before the transactional runner, and the migration's own plain
 * `CREATE INDEX IF NOT EXISTS` then finds them and does nothing. Nothing else is allowed
 * in the file: no comments, no other statements, one statement per chunk.
 */

export const ONLINE_INDEX_DIR = "online";

const BREAKPOINT = "--> statement-breakpoint";

/** A double-quoted identifier (no embedded quotes) or a plain one. */
const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;

const STATEMENT = new RegExp(
  String.raw`^CREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+(${IDENT})\s+ON\s+(${IDENT}(?:\.${IDENT})?)\s+(?:USING\s+[A-Za-z_]+\s*)?\(`,
  "i",
);

export type OnlineIndexStatement = {
  /** The statement exactly as declared, without a trailing semicolon. */
  sql: string;
  unique: boolean;
  /** The index name as Postgres stores it (unquoted, case-folded when written unquoted). */
  indexName: string;
  /** The table as written in the statement (quotes kept), for `to_regclass`. */
  table: string;
};

export type OnlineIndexDeclaration = {
  /** Journal tag of the migration that creates these indexes. */
  tag: string;
  statements: OnlineIndexStatement[];
};

export class OnlineIndexDeclarationError extends Error {
  constructor(source: string, message: string) {
    super(`${source}: ${message}`);
    this.name = "OnlineIndexDeclarationError";
  }
}

function identifierName(raw: string): string {
  return raw.startsWith('"') ? raw.slice(1, -1) : raw.toLowerCase();
}

/** Parses one statement, rejecting anything that is not a single online index build. */
export function parseOnlineIndexStatement(raw: string, source: string): OnlineIndexStatement {
  const text = raw.trim();
  if (!text) throw new OnlineIndexDeclarationError(source, "empty statement");
  if (text.includes("--") || text.includes("/*")) {
    throw new OnlineIndexDeclarationError(source, "comments are not allowed in a declaration");
  }
  const sql = text.replace(/;\s*$/, "").trimEnd();
  if (sql.includes(";")) {
    throw new OnlineIndexDeclarationError(
      source,
      "one statement per chunk: separate statements with --> statement-breakpoint",
    );
  }
  const match = STATEMENT.exec(sql);
  if (!match) {
    throw new OnlineIndexDeclarationError(
      source,
      `only CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS <name> ON <table> (...) is allowed, got: ${sql.slice(0, 80)}`,
    );
  }
  const [, unique, rawIndex = "", rawTable = ""] = match;
  if (/^only$/i.test(rawTable)) {
    throw new OnlineIndexDeclarationError(source, "ON ONLY cannot be built concurrently");
  }
  return {
    sql,
    unique: Boolean(unique),
    indexName: identifierName(rawIndex),
    table: rawTable,
  };
}

/** Parses and validates a whole declaration file. */
export function parseOnlineIndexDeclaration(tag: string, content: string): OnlineIndexDeclaration {
  const source = `${ONLINE_INDEX_DIR}/${tag}.sql`;
  const chunks = content.split(BREAKPOINT);
  const statements = chunks.map((chunk, i) =>
    parseOnlineIndexStatement(chunk, `${source} statement ${i + 1}`),
  );
  const seen = new Set<string>();
  for (const statement of statements) {
    if (seen.has(statement.indexName)) {
      throw new OnlineIndexDeclarationError(source, `declares ${statement.indexName} twice`);
    }
    seen.add(statement.indexName);
  }
  return { tag, statements };
}

/**
 * The definition text of a statement, for comparing a declaration with its migration:
 * whitespace collapsed, trailing semicolon and the CONCURRENTLY keyword removed.
 */
export function normaliseIndexDefinition(sql: string): string {
  return sql
    .trim()
    .replace(/;\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/^(CREATE (?:UNIQUE )?INDEX) CONCURRENTLY /i, "$1 ")
    .trim();
}

export type JournalMigration = { tag: string; folderMillis: number };

/**
 * Reads every declaration in `<migrationsFolder>/online`. Each file must be named after a
 * journal tag; a stray file fails the deploy rather than being silently ignored.
 */
export function readOnlineIndexDeclarations(
  migrationsFolder: string,
  journal: readonly JournalMigration[],
): OnlineIndexDeclaration[] {
  const dir = path.join(migrationsFolder, ONLINE_INDEX_DIR);
  if (!existsSync(dir)) return [];
  const tags = new Set(journal.map((m) => m.tag));
  const declarations: OnlineIndexDeclaration[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".sql")) {
      throw new OnlineIndexDeclarationError(`${ONLINE_INDEX_DIR}/${file}`, "not a .sql file");
    }
    const tag = file.slice(0, -".sql".length);
    if (!tags.has(tag)) {
      throw new OnlineIndexDeclarationError(
        `${ONLINE_INDEX_DIR}/${file}`,
        "no journal migration has this tag",
      );
    }
    declarations.push(parseOnlineIndexDeclaration(tag, readFileSync(path.join(dir, file), "utf8")));
  }
  return declarations;
}

/**
 * The declarations to build now: their migration is not in the ledger yet and is within the
 * production ceiling the runner will apply (`null` means the whole journal). Journal order.
 */
export function selectPendingDeclarations(
  declarations: readonly OnlineIndexDeclaration[],
  journal: readonly JournalMigration[],
  applied: ReadonlySet<number>,
  ceilingFolderMillis: number | null,
): OnlineIndexDeclaration[] {
  const byTag = new Map(declarations.map((d) => [d.tag, d]));
  const pending: OnlineIndexDeclaration[] = [];
  for (const migration of journal) {
    if (ceilingFolderMillis !== null && migration.folderMillis > ceilingFolderMillis) break;
    if (applied.has(migration.folderMillis)) continue;
    const declaration = byTag.get(migration.tag);
    if (declaration) pending.push(declaration);
  }
  return pending;
}
