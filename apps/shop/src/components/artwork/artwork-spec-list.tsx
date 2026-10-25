import type { ArtworkSpecRow } from "@/lib/presenters/artwork-specs.presenter";

/** The "Details" list: label and value pairs; sizes show centimetres, then inches. */
export function ArtworkSpecList({ rows }: { rows: readonly ArtworkSpecRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="shop-specs">
      {rows.map((row) => (
        <div key={row.label} className="shop-specs__row">
          <dt className="shop-specs__label">{row.label}</dt>
          <dd className="shop-specs__value">
            {row.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
