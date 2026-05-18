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

  const [categoriesResult, salesResult, artistResult] = await Promise.allSettled([
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminSalesList({ limit: 200 }),
    getAdminArtistList({ includeArchived: false, limit: 500 }),
  ]);
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const sales = salesResult.status === "fulfilled" ? salesResult.value.map((r) => r.sale) : [];
  const artists = artistResult.status === "fulfilled" ? artistResult.value.rows : [];
  const loadWarnings: string[] = [];
  if (categoriesResult.status === "rejected") loadWarnings.push("category tree");
  if (salesResult.status === "rejected") loadWarnings.push("sales list");
  if (artistResult.status === "rejected") loadWarnings.push("artist list");

  return (
    <AdminEntityFormShell
      breadcrumbs={
        <Link
          href="/admin/lots"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Lots
        </Link>
      }
      title="New lot"
      description={
        fromLotId
          ? `Cloning catalogue fields from lot ${fromLotId.slice(0, 8)}… Schedule new dates before publishing.`
          : loadWarnings.length > 0
            ? `Some lists could not be loaded (${loadWarnings.join(", ")}). You can still create a draft.`
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
