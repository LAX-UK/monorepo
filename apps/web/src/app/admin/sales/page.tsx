import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import Link from "next/link";

export default async function AdminSalesPage() {
  let rows: Awaited<ReturnType<typeof getAdminSalesList>> = [];
  let err: string | null = null;
  try {
    rows = await getAdminSalesList({ limit: 100 });
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  return (
    <div className="max-w-5xl space-y-8">
      <DisplayHeading as="h1" className="text-4xl">
        Sales
      </DisplayHeading>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-body text-on-surface-variant">
          Umbrella sessions grouping catalogued lots. Create drafts, attach standalone lots,
          publish, or cancel from each sale page.
        </p>
        <Link
          href="/admin/sales/new"
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
        >
          New sale
        </Link>
      </div>
      {err ? (
        <p className="text-sm text-error" role="alert">
          {err}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-on-surface-variant">No sales found.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/15 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 ring-1 ring-outline-variant/10">
          {rows.map(({ sale, lots }) => (
            <li
              key={sale.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="font-headline text-lg text-on-surface">{sale.title}</p>
                <p className="mt-1 font-label text-xs uppercase tracking-widest text-secondary">
                  {sale.status} · {lots.length} lot{lots.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/admin/sales/${sale.id}`}
                  className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
                >
                  Manage
                </Link>
                <Link
                  href={`/sales/${sale.id}`}
                  className="font-label text-xs font-bold uppercase tracking-widest text-secondary underline-offset-4 hover:underline"
                >
                  View on site
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
