import { LEGACY_THELAX_ORIGIN } from "./legacy-thelax-urls.mjs";

/** Minimal RFC 4180 parser; skips GA4's `#` preamble lines and blank rows. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()) && !cells[0].startsWith("#"));
}

/** Rows as objects keyed by lower-cased header. */
export function csvRecords(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((key) => key.trim().toLowerCase());
  return rows.map((cells) =>
    Object.fromEntries(keys.map((key, i) => [key, cells[i]?.trim() ?? ""])),
  );
}

function pick(record, candidates) {
  for (const key of candidates)
    if (record[key] !== undefined && record[key] !== "") return record[key];
  return undefined;
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Legacy path key: pathname, plus `?word=` for glossary letters (the only indexed query). */
export function legacyKey(urlOrPath) {
  if (!urlOrPath) return null;
  let url;
  try {
    url = new URL(urlOrPath, LEGACY_THELAX_ORIGIN);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "thelax.art" && host !== "lax.art") return null;
  const word = url.pathname === "/glossary" ? url.searchParams.get("word") : null;
  return word ? `/glossary?word=${word.toUpperCase()}&order=1` : url.pathname;
}

const PAGE_COLUMNS = ["top pages", "page", "pages", "url", "landing page"];

/** Search Console Performance → Pages export. */
export function readSearchConsolePages(text) {
  return csvRecords(text)
    .map((record) => ({
      key: legacyKey(pick(record, PAGE_COLUMNS)),
      clicks: number(pick(record, ["clicks"])),
      impressions: number(pick(record, ["impressions"])),
    }))
    .filter((row) => row.key);
}

/** Search Console Links → Top linked pages, or an Ahrefs/Semrush backlinks export. */
export function readLinkedPages(text) {
  return csvRecords(text)
    .map((record) => ({
      key: legacyKey(
        pick(record, ["top linked pages", "target page", "target url", "url", "page"]),
      ),
      linkingSites: Math.max(
        1,
        number(pick(record, ["linking sites", "referring domains", "domains", "incoming links"])),
      ),
    }))
    .filter((row) => row.key);
}

/** GA4 Landing page report (organic search segment). */
export function readGa4LandingPages(text) {
  return csvRecords(text)
    .map((record) => ({
      key: legacyKey(
        pick(record, ["landing page", "landing page + query string", ...PAGE_COLUMNS]),
      ),
      sessions: number(pick(record, ["sessions", "users", "active users"])),
    }))
    .filter((row) => row.key);
}

/**
 * Gold list = top N by clicks ∪ top N by organic sessions ∪ every URL with backlinks.
 * Paths missing from the crawl inventory are flagged: they still need a redirect.
 */
export function buildGoldList({ pages = [], links = [], landing = [], inventoryPaths, top = 200 }) {
  const byKey = new Map();
  const entry = (key) => {
    if (!byKey.has(key)) {
      byKey.set(key, {
        path: key,
        clicks: 0,
        impressions: 0,
        linkingSites: 0,
        sessions: 0,
        reasons: [],
      });
    }
    return byKey.get(key);
  };
  for (const row of pages) {
    const item = entry(row.key);
    item.clicks += row.clicks;
    item.impressions += row.impressions;
  }
  for (const row of links) entry(row.key).linkingSites += row.linkingSites;
  for (const row of landing) entry(row.key).sessions += row.sessions;

  const all = [...byKey.values()];
  const topBy = (field) =>
    new Set(
      all
        .filter((item) => item[field] > 0)
        .sort((a, b) => b[field] - a[field] || a.path.localeCompare(b.path))
        .slice(0, top)
        .map((item) => item.path),
    );
  const topClicks = topBy("clicks");
  const topSessions = topBy("sessions");
  const gold = all.filter((item) => {
    if (topClicks.has(item.path)) item.reasons.push(`top-${top}-clicks`);
    if (topSessions.has(item.path)) item.reasons.push(`top-${top}-organic-sessions`);
    if (item.linkingSites > 0) item.reasons.push("backlinked");
    return item.reasons.length > 0;
  });
  for (const item of gold) {
    if (!inventoryPaths.has(item.path)) item.reasons.push("not-in-inventory");
  }
  return gold.sort(
    (a, b) =>
      b.clicks - a.clicks || b.linkingSites - a.linkingSites || a.path.localeCompare(b.path),
  );
}
