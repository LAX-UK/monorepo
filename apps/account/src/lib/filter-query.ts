/**
 * Filter state lives in the page's URL query, so a filtered list can be bookmarked, shared, and
 * stepped back through. These helpers turn the page's filters into that query and back into the
 * chips that show what is applied. They hold no UI, so server and client code share them.
 */

export type FilterFieldVm = {
  name: string;
  /** The group's name, for example "Status". */
  label: string;
  /** The selected option's value, or "" for "any". */
  value: string;
  options: readonly { value: string; label: string }[];
  /** Words placed before the option in its chip when the option alone is unclear ("Acquired in"). */
  chipPrefix?: string;
};

export type ActiveFilterChip = {
  name: string;
  /** What the chip says, for example "LAX Bid". */
  text: string;
  /** The group it belongs to, so a screen reader hears "Remove Product filter: LAX Bid". */
  group: string;
};

export type FilterSearchVm = {
  name: string;
  value: string;
  label: string;
  placeholder: string;
};

export type FilterChange =
  | { kind: "field"; name: string; value: string }
  | { kind: "search"; value: string }
  | { kind: "clear" };

/** The page's URL with one change applied and everything else kept, so filters combine. */
export function filterHref(
  action: string,
  fields: readonly FilterFieldVm[],
  search: FilterSearchVm | undefined,
  change?: FilterChange,
): string {
  const query = new URLSearchParams();
  if (change?.kind !== "clear") {
    for (const field of fields) {
      const next =
        change?.kind === "field" && change.name === field.name ? change.value : field.value;
      if (next) query.set(field.name, next);
    }
    if (search) {
      const next = change?.kind === "search" ? change.value.trim() : search.value;
      if (next) query.set(search.name, next);
    }
  }
  const text = query.toString();
  return text ? `${action}?${text}` : action;
}

/** One chip per filter that is set, in the order the groups are listed. */
export function activeFilterChips(fields: readonly FilterFieldVm[]): ActiveFilterChip[] {
  return fields.flatMap((field) => {
    if (!field.value) return [];
    const option = field.options.find((candidate) => candidate.value === field.value);
    const label = option?.label ?? field.value;
    return [
      {
        name: field.name,
        text: field.chipPrefix ? `${field.chipPrefix} ${label}` : label,
        group: field.label,
      },
    ];
  });
}

/** "works" becomes "work" and "entries" becomes "entry", for a button that names one result. */
export function singularOf(noun: string): string {
  const last = noun.split(" ").pop() ?? noun;
  const head = noun.slice(0, noun.length - last.length);
  if (last.endsWith("ies")) return `${head}${last.slice(0, -3)}y`;
  return `${head}${last.endsWith("s") ? last.slice(0, -1) : last}`;
}
