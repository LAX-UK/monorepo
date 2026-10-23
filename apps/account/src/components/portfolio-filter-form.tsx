import { Button } from "@auction/ui/components/button";

export type FilterFieldVm = {
  name: string;
  label: string;
  /** The selected option's value, or "" for "any". */
  value: string;
  options: readonly { value: string; label: string }[];
};

const SELECT_CLASS =
  "min-h-11 w-full rounded-lg border border-border-hairline bg-surface px-3 text-sm text-on-surface";

/**
 * Filters as a plain GET form: the choices live in the URL, so a filtered list can be
 * bookmarked or shared and works without client JavaScript.
 */
export function PortfolioFilterForm({
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
    <form method="get" action={action} aria-label={label} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {fields.map((field) => (
          <label
            key={field.name}
            className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant"
          >
            {field.label}
            <select name={field.name} defaultValue={field.value} className={SELECT_CLASS}>
              <option value="">Any</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" className="min-h-11">
          Apply filters
        </Button>
        {isFiltered ? (
          <a href={action} className="inline-flex min-h-11 items-center text-sm underline">
            Clear filters
          </a>
        ) : null}
      </div>
    </form>
  );
}
