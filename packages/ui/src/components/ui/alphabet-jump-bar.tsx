import { cn } from "../../lib/utils.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");

export type LetterFacet = {
  /** Single character a–z, `#` for any digit, or `other`. */
  letter: string;
  count: number;
};

export type AlphabetJumpBarProps = {
  /** Base URL path, e.g. `/artists` */
  basePath: string;
  /** Current query string (without leading `?`), used to preserve filters when changing letter. */
  preservedQuery?: string | undefined;
  /** Active first-letter filter: single a–z, 0–9, `other`, or empty for “all”. */
  active?: string | undefined;
  /** When provided, letters with `count === 0` are dimmed and not clickable. */
  letterCounts?: ReadonlyArray<LetterFacet> | undefined;
  /** When true, render letter buckets as path segments (`/artists/letter/a`)
   * instead of `?letter=a` query params. Used by the marketing route group. */
  pathSegments?: boolean | undefined;
  className?: string | undefined;
};

function hrefForLetter(
  basePath: string,
  preservedQuery: string | undefined,
  letter: string | null,
  pathSegments: boolean,
) {
  const sp = new URLSearchParams(preservedQuery ?? "");
  sp.delete("offset");
  if (pathSegments) {
    const q = sp.toString();
    if (letter === null || letter === "") return q ? `${basePath}?${q}` : basePath;
    const slug = letter === "other" ? "other" : letter;
    return q ? `${basePath}/letter/${slug}?${q}` : `${basePath}/letter/${slug}`;
  }
  if (letter === null || letter === "") {
    sp.delete("letter");
  } else {
    sp.set("letter", letter);
  }
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

function isActiveKey(active: string | undefined, key: string | null) {
  const a = (active ?? "").trim().toLowerCase();
  if (key === null) return a === "" || a === "all";
  return a === key.toLowerCase();
}

type JumpLinkProps = {
  href: string;
  label: string;
  active: boolean;
  count?: number | undefined;
  /** When `true`, render as a non-interactive span (used when `count === 0`). */
  disabled?: boolean | undefined;
};

function JumpLink({ href, label, active, count, disabled }: JumpLinkProps) {
  const className = cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-1.5 py-1 font-label text-[10px] uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    disabled
      ? "cursor-not-allowed text-on-surface-variant/30"
      : active
        ? "bg-primary text-on-primary"
        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  );
  const aria = count !== undefined ? `${label} (${count})` : label;
  if (disabled) {
    return (
      <span className={className} aria-disabled="true" aria-label={aria}>
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      aria-label={aria}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {label}
    </a>
  );
}

function letterCountFor(
  letter: string,
  counts: ReadonlyArray<LetterFacet> | undefined,
): number | undefined {
  if (!counts) return undefined;
  const lower = letter.toLowerCase();
  if (lower === "#" || (lower >= "0" && lower <= "9")) {
    return counts.find((c) => c.letter === "#")?.count;
  }
  return counts.find((c) => c.letter === lower)?.count;
}

/** A–Z + 0–9 + “Other” jump links for directory-style pages (SEO-friendly anchors). */
export function AlphabetJumpBar({
  basePath,
  preservedQuery,
  active,
  letterCounts,
  pathSegments,
  className,
}: AlphabetJumpBarProps) {
  const pq = preservedQuery?.replace(/^\?/, "");
  const seg = pathSegments === true;
  const otherCount = letterCounts?.find((c) => c.letter === "other")?.count;
  return (
    <nav aria-label="Jump to letter" className={cn("flex flex-wrap items-center gap-1", className)}>
      <JumpLink
        href={hrefForLetter(basePath, pq, null, seg)}
        label="All"
        active={isActiveKey(active, null)}
      />
      {LETTERS.map((L) => {
        const count = letterCountFor(L, letterCounts);
        const disabled = count === 0;
        return (
          <JumpLink
            key={L}
            href={hrefForLetter(basePath, pq, L.toLowerCase(), seg)}
            label={L}
            active={isActiveKey(active, L.toLowerCase())}
            count={count}
            disabled={disabled}
          />
        );
      })}
      {/* All digit buckets share the `#` facet; render a single `#` link instead
       * of one-per-digit. The query/path scheme still accepts 0–9 directly. */}
      <JumpLink
        href={hrefForLetter(basePath, pq, DIGITS[0] ?? "0", seg)}
        label="#"
        active={(active ?? "") >= "0" && (active ?? "") <= "9"}
        count={letterCounts?.find((c) => c.letter === "#")?.count}
        disabled={
          letterCounts
            ? otherCount === 0 && letterCounts.find((c) => c.letter === "#")?.count === 0
            : false
        }
      />
      <JumpLink
        href={hrefForLetter(basePath, pq, "other", seg)}
        label="•"
        active={isActiveKey(active, "other")}
        count={otherCount}
        disabled={otherCount === 0}
      />
    </nav>
  );
}
