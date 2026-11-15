/**
 * The compositor-only motion rule (docs/design/motion.md, "Compositor only").
 *
 * Motion animates transform and opacity (and clip-path for existing reveals). It never uses
 * `transition: all`, and never transitions or keyframes a property that makes the browser lay out
 * or repaint the page: width, height, top, left, margin, box-shadow, filter or backdrop-filter.
 *
 * `findCompositorViolations` reads one source file (CSS, or the class names and inline styles of
 * TS/TSX) and returns one finding per offence, each with a rule id:
 *   - `transition-all`          `transition: all`, `transition-property: all` or Tailwind `transition-all`
 *   - `transition:<property>`   a transition of a banned property (CSS, Tailwind `transition-[..]`,
 *                               or Tailwind `transition-shadow`)
 *   - `keyframes:<property>`    an `@keyframes` block that sets a banned property
 */

/** Properties that must not be animated. Longhands are matched by prefix (margin-left, top, ...). */
export const BANNED_PROPERTIES = [
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "max-height",
  "top",
  "left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-inline",
  "margin-block",
  "box-shadow",
  "filter",
  "backdrop-filter",
];

const PROPERTY = BANNED_PROPERTIES.map((p) => p.replace(/-/g, "\\-")).join("|");
/** A banned property as a whole identifier: `height` yes, `line-height`, `--height` or `heights` no. */
const BANNED_WORD = new RegExp(`(?<![\\w-])(${PROPERTY})(?![\\w-])`, "g");
const ALL_WORD = /(?<![\w-])all(?![\w-])/;

const TRANSITION_DECLARATION =
  /(?<![\w-])(?:transition-property|transitionProperty|transition)["']?\s*:\s*([^;}\n]+)/g;
const TAILWIND_ARBITRARY = /(?<![\w-])transition-\[([^\]\s]+)\]/g;
const TAILWIND_ALL = /(?<![\w-])transition-all(?![\w-])/g;
const TAILWIND_SHADOW = /(?<![\w-])transition-shadow(?![\w-])/g;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/** Banned properties named in `text`, de-duplicated, in order of appearance. */
function bannedIn(text) {
  return [...new Set([...text.matchAll(BANNED_WORD)].map((m) => m[1]))];
}

/** The text of the `{ ... }` block that opens at or after `from`, and where it ends. */
function readBlock(source, from) {
  const open = source.indexOf("{", from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return { body: source.slice(open + 1, i), end: i };
  }
  return null;
}

/** @returns {{ line: number, rule: string }[]} */
export function findCompositorViolations(rawSource) {
  const source = stripComments(rawSource);
  const found = [];
  const add = (index, rule) => found.push({ line: lineOf(source, index), rule });

  for (const m of source.matchAll(TAILWIND_ALL)) add(m.index, "transition-all");
  for (const m of source.matchAll(TAILWIND_SHADOW)) add(m.index, "transition:box-shadow");
  for (const m of source.matchAll(TAILWIND_ARBITRARY)) {
    if (ALL_WORD.test(m[1])) add(m.index, "transition-all");
    for (const property of bannedIn(m[1].replace(/_/g, " ")))
      add(m.index, `transition:${property}`);
  }
  for (const m of source.matchAll(TRANSITION_DECLARATION)) {
    if (ALL_WORD.test(m[1])) add(m.index, "transition-all");
    for (const property of bannedIn(m[1])) add(m.index, `transition:${property}`);
  }

  for (const m of source.matchAll(/@keyframes\s+[\w-]+/g)) {
    const block = readBlock(source, m.index + m[0].length);
    if (!block) continue;
    const declared = [...block.body.matchAll(new RegExp(`(?<![\\w-])(${PROPERTY})\\s*:`, "g"))].map(
      (d) => d[1],
    );
    for (const property of new Set(declared)) add(m.index, `keyframes:${property}`);
  }

  return found.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

/**
 * Compares findings with the allowlist: `{ file, rule, count }` entries for today's offenders.
 * A new offence, or more of an allowed one, fails. So does an entry that is now too high, so the
 * list only ever shrinks: later PRs remove entries as they fix the code.
 *
 * @param {Map<string, { line: number, rule: string }[]>} findingsByFile
 * @param {{ file: string, rule: string, count: number }[]} allowlist
 * @returns {string[]} problems, empty when the check passes
 */
export function compareWithAllowlist(findingsByFile, allowlist) {
  const allowed = new Map(allowlist.map((e) => [`${e.file}::${e.rule}`, e.count]));
  const problems = [];
  const seen = new Set();
  for (const [file, findings] of findingsByFile) {
    const byRule = new Map();
    for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f.line]);
    for (const [rule, lines] of byRule) {
      const key = `${file}::${rule}`;
      seen.add(key);
      const limit = allowed.get(key) ?? 0;
      if (lines.length > limit) {
        problems.push(
          `${file}:${lines.join(",")} ${describe(rule)} (allowed ${limit}, found ${lines.length})`,
        );
      } else if (lines.length < limit) {
        problems.push(
          `${file} ${rule}: allowlist says ${limit} but only ${lines.length} remain; lower the count or remove the entry`,
        );
      }
    }
  }
  for (const [key, count] of allowed) {
    if (!seen.has(key))
      problems.push(`${key}: allowlisted ${count} but none remain; remove the entry`);
  }
  return problems;
}

export function describe(rule) {
  if (rule === "transition-all") return "uses transition-all; list the properties that change";
  const [kind, property] = rule.split(":");
  return kind === "transition"
    ? `transitions ${property}; animate transform or opacity instead`
    : `has @keyframes that set ${property}; animate transform or opacity instead`;
}
