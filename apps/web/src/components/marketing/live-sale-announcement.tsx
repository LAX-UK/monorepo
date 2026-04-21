import type { LiveSaleReader } from "@/lib/data/readers/marketing-readers";
import Link from "next/link";

type Props = {
  reader: LiveSaleReader;
};

/** Marketing shell strip when the injected reader finds an active sale. */
export async function LiveSaleAnnouncement({ reader }: Props) {
  const row = await reader.peek();
  if (!row) return null;

  return (
    <div className="border-b border-primary/25 bg-primary-container/15 px-4 py-2 text-center text-sm text-on-surface">
      <span className="font-label text-[0.65rem] font-bold uppercase tracking-widest text-primary">
        Live saleroom
      </span>
      <span className="mx-2 text-on-surface-variant" aria-hidden>
        ·
      </span>
      <Link
        href={`/sales/${row.id}`}
        className="font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {row.title} — view catalog
      </Link>
    </div>
  );
}
