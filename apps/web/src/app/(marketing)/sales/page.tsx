import { getServerSalesList } from "@/lib/data/http/sales.server";
import { formatMoney } from "@/lib/format-currency";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { itemListJsonLd } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Sales",
  description:
    "Browse active and scheduled sales — curated catalogs with shared timing and house terms.",
  path: "/sales",
});

export default async function SalesListPage() {
  let rows: Awaited<ReturnType<typeof getServerSalesList>> = [];
  let err: string | null = null;
  try {
    const [active, scheduled] = await Promise.all([
      getServerSalesList({ status: "active", limit: 24 }),
      getServerSalesList({ status: "scheduled", limit: 24 }),
    ]);
    rows = [...active, ...scheduled];
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  const base = getSiteUrl();
  const listLd =
    !err && rows.length > 0
      ? itemListJsonLd(
          rows.map((r) => ({
            name: r.sale.title,
            url: `${base}/sales/${r.sale.id}`,
          })),
        )
      : null;
  const listLdText = listLd ? JSON.stringify(listLd).replace(/</g, "\\u003c") : null;

  return (
    <main id="main-content" className="bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-20">
      {listLdText ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>
      ) : null}
      <h1 className="mb-4 font-headline text-4xl tracking-tight md:text-5xl">Sales</h1>
      <p className="mb-12 max-w-2xl font-body text-on-surface-variant">
        Browse umbrella sessions — each sale groups multiple catalogued lots with shared timing and
        house terms.
      </p>
      {err ? (
        <p className="text-sm text-error" role="alert">
          {err}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-on-surface-variant">No upcoming or active sales right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ sale, lots }) => {
            const img = sale.coverImages[0];
            return (
              <li key={sale.id}>
                <Link
                  href={`/sales/${sale.id}`}
                  className="group block overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low/40 ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={sale.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : null}
                    <div className="absolute left-4 top-4 rounded-sm bg-surface/90 px-2 py-1 font-label text-[0.65rem] font-bold uppercase tracking-wider text-on-surface">
                      {sale.status}
                    </div>
                  </div>
                  <div className="p-5">
                    <h2 className="font-headline text-2xl text-on-surface group-hover:text-primary">
                      {sale.title}
                    </h2>
                    <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                      {lots.length} lot{lots.length === 1 ? "" : "s"} · Ends{" "}
                      {sale.endTime.toLocaleDateString()}
                    </p>
                    {lots[0] ? (
                      <p className="mt-3 font-body text-sm text-on-surface-variant">
                        From {formatMoney(lots[0].currentPrice)} on featured lots
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
