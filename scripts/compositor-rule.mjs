import postcss from "postcss";

/**
 * The compositor-only motion rule (docs/design/motion.md, "Compositor only").
 *
 * Motion animates transform and opacity (and clip-path for existing reveals). It never uses
 * `transition: all`, and never transitions or keyframes a property that makes the browser lay out
 * or repaint the page: width, height, top, left, margin, box-shadow, filter or backdrop-filter.
 *
 * `findCompositorViolations` reads one source file: CSS is parsed with postcss, so a declaration
 * is read whole even when its value wraps across lines; TS/TSX is scanned for class names and
 * inline styles (`//` comments are ignored) and returns one finding per offence, each with a rule id:
 *   - `transition-all`          `transition: all`, `transition-property: all` or Tailwind `transition-all`
 *   - `transition:<property>`   a transition of a banned property (CSS, Tailwind `transition-[..]`,
 *                               or Tailwind `transition-shadow`)
 *   - `transition-bare`        Tailwind's bare `transition` utility (animates box-shadow and filters)
 *   - `keyframes:<property>`    an `@keyframes` block that sets a banned property
 */

/**
 * Properties that must not be animated. The `margin-*` longhands (including logical ones such as
 * margin-inline-start) are banned by prefix, and a `-webkit-` prefix is ignored, so
 * `-webkit-backdrop-filter` counts as `backdrop-filter`.
 */
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
  "box-shadow",
  "filter",
  "backdrop-filter",
];

const normalize = (name) => name.toLowerCase().replace(/^-webkit-/, "");
const isBanned = (name) => {
  const n = normalize(name);
  return BANNED_PROPERTIES.includes(n) || n.startsWith("margin-");
};

const IDENT = /-?[a-zA-Z_][\w-]*/g;
const ALL_WORD = /(?<![\w-])all(?![\w-])/;

/** Class-name utilities. Tailwind v4's bare `transition` also animates box-shadow and filters. */
const TAILWIND_ARBITRARY = /(?<![\w-])transition-\[([^\]\s]+)\]/g;
const TAILWIND_ALL = /(?<![\w-])transition-all(?![\w-])/g;
const TAILWIND_SHADOW = /(?<![\w-])transition-shadow(?![\w-])/g;

const TRANSITION_PROPERTY = /^(?:transition|transition-property)$/i;
const JS_TRANSITION_KEY =
  /(?<![\w-])["']?(transition|transitionProperty|transition-property)["']?\s*:/g;

function blank(text) {
  return text.replace(/[^\n]/g, " ");
}

/** Blanks `/* *\/` comments, keeping offsets and line numbers. */
function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, blank);
}

/** Blanks `// ...` comments in script files (not the `//` of a URL such as https://x). */
function stripLineComments(source) {
  return source.replace(
    /(^|[^:\w"'`])\/\/[^\n]*/g,
    (m, lead) => lead + blank(m.slice(lead.length)),
  );
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/** Banned properties named in a value, de-duplicated, in order of appearance. */
function bannedIn(text) {
  return [...new Set((text.match(IDENT) ?? []).filter(isBanned).map(normalize))];
}

function classRules(source, add) {
  for (const m of source.matchAll(TAILWIND_ALL)) add(m.index, "transition-all");
  for (const m of source.matchAll(TAILWIND_SHADOW)) add(m.index, "transition:box-shadow");
  for (const m of source.matchAll(TAILWIND_ARBITRARY)) {
    const value = m[1].replace(/_/g, " ");
    if (ALL_WORD.test(value)) add(m.index, "transition-all");
    for (const property of bannedIn(value)) add(m.index, `transition:${property}`);
  }
}

function transitionValueRules(value, index, add) {
  if (ALL_WORD.test(value)) add(index, "transition-all");
  for (const property of bannedIn(value)) add(index, `transition:${property}`);
}

function inKeyframes(node) {
  for (let p = node.parent; p; p = p.parent)
    if (p.type === "atrule" && /keyframes$/i.test(p.name)) return true;
  return false;
}

/** CSS: whole declarations from postcss, so values wrapped across lines are read in full. */
function cssRules(source, add) {
  let root;
  try {
    root = postcss.parse(source);
  } catch {
    return false;
  }
  const at = (node) => lineStart[node.source.start.line - 1] ?? 0;
  const lineStart = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) lineStart.push(i + 1);
  root.walkDecls((decl) => {
    if (inKeyframes(decl)) return;
    if (TRANSITION_PROPERTY.test(decl.prop)) transitionValueRules(decl.value, at(decl), add);
  });
  root.walkAtRules(/keyframes$/i, (rule) => {
    const properties = new Set();
    rule.walkDecls((decl) => {
      if (isBanned(decl.prop)) properties.add(normalize(decl.prop));
    });
    for (const property of properties) add(at(rule), `keyframes:${property}`);
  });
  return true;
}

/** Reads the value of a script-side declaration: a string literal in full, else up to `;` or `}` (so CSS in a template literal can wrap). */
function readScriptValue(source, from) {
  let i = from;
  while (/\s/.test(source[i] ?? "")) i++;
  const quote = source[i];
  if (quote === '"' || quote === "'" || quote === "`") {
    let j = i + 1;
    while (j < source.length && source[j] !== quote) j += source[j] === "\\" ? 2 : 1;
    return source.slice(i + 1, j);
  }
  let depth = 0;
  let j = i;
  for (; j < source.length; j++) {
    const c = source[j];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth <= 0 && (c === ";" || c === "}")) break;
  }
  return source.slice(i, j);
}

const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const CLASS_TOKEN = /^[\w:[\]/.%&>*()#!,-]+$/;

/**
 * Tailwind's bare `transition` utility, in a string that reads as a class list (every token is
 * class-shaped and another token has a `-` or `:`), so prose such as "a transition towards" is not
 * mistaken for it.
 */
function bareTransitionRules(source, add) {
  for (const m of source.matchAll(STRING_LITERAL)) {
    const tokens = m[2]
      .replace(/\$\{[^}]*\}/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const bare = tokens.some((t) => t.split(":").pop() === "transition");
    if (
      bare &&
      tokens.length > 1 &&
      tokens.every((t) => CLASS_TOKEN.test(t)) &&
      tokens.some((t) => /[-:]/.test(t) && t.split(":").pop() !== "transition")
    )
      add(m.index, "transition-bare");
  }
}

/** TS/TSX/JS: class names, inline `transition` styles, and CSS inside template literals. */
function scriptRules(source, add, jsx = true) {
  classRules(source, add);
  if (jsx) bareTransitionRules(source, add);
  for (const m of source.matchAll(JS_TRANSITION_KEY)) {
    transitionValueRules(readScriptValue(source, m.index + m[0].length), m.index, add);
  }
  for (const m of source.matchAll(/@keyframes\s+[\w-]+\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < source.length; end++) {
      if (source[end] === "{") depth++;
      else if (source[end] === "}" && --depth === 0) break;
    }
    const body = source.slice(open + 1, end);
    const properties = new Set(
      [...body.matchAll(/(?<![\w-])([\w-]+)\s*:/g)]
        .map((d) => d[1])
        .filter(isBanned)
        .map(normalize),
    );
    for (const property of properties) add(m.index, `keyframes:${property}`);
  }
}

/**
 * @param {string} rawSource
 * @param {{ filename?: string }} [options] `.css` files are parsed as CSS; anything else is
 *   read as TS/TSX. Without a filename the source is treated as CSS if it parses as CSS and
 *   holds no JSX/JS markers, so snippets work in tests.
 * @returns {{ line: number, rule: string }[]}
 */
export function findCompositorViolations(rawSource, options = {}) {
  const isCss = options.filename ? /\.css$/i.test(options.filename) : options.kind !== "script";
  const found = [];
  if (isCss) {
    const source = stripBlockComments(rawSource);
    const add = (index, rule) => found.push({ line: lineOf(source, index), rule });
    if (!cssRules(source, add)) throw new Error("compositor lint: the source is not valid CSS");
    classRules(source, add); // @apply and utility class selectors
  } else {
    const source = stripLineComments(stripBlockComments(rawSource));
    scriptRules(
      source,
      (index, rule) => found.push({ line: lineOf(source, index), rule }),
      /\.[jt]sx$/i.test(options.filename ?? ""),
    );
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
  if (rule === "transition-bare")
    return "uses Tailwind's bare transition (animates box-shadow and filters); use transition-colors, transition-opacity, transition-transform or transition-[...]";
  if (rule === "transition-all") return "uses transition-all; list the properties that change";
  const [kind, property] = rule.split(":");
  return kind === "transition"
    ? `transitions ${property}; animate transform or opacity instead`
    : `has @keyframes that set ${property}; animate transform or opacity instead`;
}
