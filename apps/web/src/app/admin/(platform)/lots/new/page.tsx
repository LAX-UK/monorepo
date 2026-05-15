import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { AdminLotForm } from "@/components/admin/admin-lot-form";
import {
  getAdminArtistList,
  getAdminLotById,
  getAdminSalesList,
} from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminLotFormValues,
  lotToAdminLotFormValues,
} from "@/lib/forms/schemas/admin-lot-defaults";
import Link from "next/link";

type PageProps = { searchParams: Promise<{ fromLot?: string }> };

export default async function AdminNewLotPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const fromLotId = (sp.fromLot ?? "").trim();
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  let cloneDefaults = emptyAdminLotFormValues();
  if (fromLotId) {
    try {
      const existing = await getAdminLotById(fromLotId);
      if (existing) {
        cloneDefaults = {
          ...lotToAdminLotFormValues(existing),
          title: `${existing.title} (copy)`,
        };
      }
    } catch {
      /* ignore clone failures — fall back to empty form */
    }
  }
  if (englishOnlyAuctionsLocked && cloneDefaults.auctionType !== "english") {
    cloneDefaults = { ...cloneDefaults, auctionType: "english" };
  }

  const [categories, salesRows, artistList] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminSalesList({ limit: 200 }).catch(() => []),
    getAdminArtistList({ includeArchived: false, limit: 500 }),
  ]);
  const artists = artistList.rows;
  const sales = salesRows.map((r) => r.sale);

  return (
    <AdminEntityFormShell
      breadcrumbs={
        <Link
          href="/admin/lots"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Lots
        </Link>
      }
      title="New lot"
      description={
        fromLotId
          ? `Cloning catalogue fields from lot ${fromLotId.slice(0, 8)}… Schedule new dates before publishing.`
          : undefined
      }
    >
      <AdminLotForm
        mode="create"
        defaultValues={cloneDefaults}
        categories={categories}
        sales={sales}
        artists={artists}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
      />
    </AdminEntityFormShell>
  );
}
