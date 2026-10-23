import { FilterRow } from "@auction/ui/components/filter-row";

export type FilterFieldVm = {
  name: string;
  label: string;
  /** The selected option's value, or "" for "any". */
  value: string;
  options: readonly { value: string; label: string }[];
};

/** The page's URL with one filter changed and every other kept, so chips combine. */
function hrefWith(
  action: string,
  fields: readonly FilterFieldVm[],
  name: string,
  value: string,
): string {
  const query = new URLSearchParams();
  for (const field of fields) {
    const next = field.name === name ? value : field.value;
    if (next) query.set(field.name, next);
  }
  const text = query.toString();
  return text ? `${action}?${text}` : action;
}

/**
 * Filters as groups of links: the choices live in the URL, so a filtered list can be
 * bookmarked or shared and works without client JavaScript. A group with nothing to choose
 * from is left out.
 */
export function PortfolioFilters({
  action,
  label,
  fields,
  isFiltered,
}: {
  action: string;
  label: string;
  fields: readonly FilterFieldVm[];
  isFiltered: boolean;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      {fields
        .filter((field) => field.options.length > 0)
        .map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-on-surface-variant">{field.label}</p>
            <FilterRow
              mode="link"
              label={`Filter by ${field.label.toLowerCase()}`}
              items={[
                {
                  id: "any",
                  label: "Any",
                  href: hrefWith(action, fields, field.name, ""),
                  active: field.value === "",
                },
                ...field.options.map((option) => ({
                  id: option.value,
                  label: option.label,
                  href: hrefWith(action, fields, field.name, option.value),
                  active: field.value === option.value,
                })),
              ]}
            />
          </div>
        ))}
      {isFiltered ? (
        <a href={action} className="inline-flex min-h-11 items-center text-sm underline">
          Clear filters
        </a>
      ) : null}
    </section>
  );
}
