import type { ReactNode } from "react";

type Props = {
  /** Id of the control this row labels. */
  id: string;
  title: string;
  description: string;
  /** Extra line under the description, such as a link to the cookie list. */
  detail?: ReactNode;
  /** The switch, or a plain "Always on" tag. */
  control: ReactNode;
};

/** One cookie category in the settings: title and plain description on the left, its control on the right. */
export function ConsentCategoryRow({ id, title, description, detail, control }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-lax-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-lax-ui font-medium text-lax-fg">
          {title}
        </label>
        <p id={`${id}-desc`} className="text-lax-13 text-lax-muted">
          {description}
        </p>
        {detail}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
