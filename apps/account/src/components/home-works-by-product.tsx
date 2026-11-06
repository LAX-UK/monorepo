import type { WorksBarVm, WorksByProductVm } from "@/server/domain/home-works-by-product.vm";
import { ProductName } from "./product-name";

function worksText(count: number): string {
  return `${count} ${count === 1 ? "work" : "works"}`;
}

function Bar({ bar }: { bar: WorksBarVm }) {
  if (bar.status === "unanswered") {
    return (
      <li className="text-xs text-on-surface-variant">
        <ProductName product={bar.product}>{bar.label}</ProductName> didn't answer
      </li>
    );
  }
  return (
    <li className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
      <span className="sr-only">{`${bar.label}, ${worksText(bar.count)}`}</span>
      <span aria-hidden>
        <ProductName product={bar.product}>{bar.label}</ProductName>
      </span>
      <span aria-hidden className="flex h-2 items-center">
        {/* Zero keeps a 2px tick on the baseline, so the product is never a missing row. */}
        <span
          className="h-full min-w-0.5 rounded-full bg-on-surface-variant"
          style={{ width: `${bar.widthPercent}%` }}
        />
      </span>
      <span aria-hidden className="text-right font-medium tabular-nums text-on-surface">
        {bar.count}
      </span>
    </li>
  );
}

/** Works by product as ranked bars in one ink series; the product's own accent names each bar. */
export function WorksByProduct({ chart }: { chart: WorksByProductVm }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-on-surface-variant">Works by product</h3>
      <ul className="flex flex-col gap-3">
        {chart.bars.map((bar) => (
          <Bar key={bar.product} bar={bar} />
        ))}
      </ul>
    </div>
  );
}
