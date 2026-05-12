import { AdminLotForm } from "@/components/admin/admin-lot-form";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DisplayHeading } from "@/components/ui/typography";
import {
  getAdminArtistList,
  getAdminLotById,
  getAdminUserList,
} from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminLotFormValues,
  lotToAdminLotFormValues,
} from "@/lib/forms/schemas/admin-lot-defaults";
import Link from "next/link";

type PageProps = { searchParams: Promise<{ fromLot?: string }> };

export default async function AdminNewAuctionPage({ searchParams }: PageProps) {
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

  const [categories, users, artists] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminUserList({ limit: 100 }),
    getAdminArtistList(),
  ]);

  return (
    <AppScreen className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/admin/lots"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Auctions
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        New auction
      </DisplayHeading>
      {fromLotId ? (
        <p className="font-body text-sm text-on-surface-variant">
          Cloning catalogue fields from lot{" "}
          <span className="font-mono text-xs">{fromLotId.slice(0, 8)}…</span>. Schedule new dates
          before publishing.
        </p>
      ) : null}

      <AdminLotForm
        mode="create"
        defaultValues={cloneDefaults}
        categories={categories}
        sellers={users.rows}
        artists={artists}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
      />
    </AppScreen>
  );
}
