import "server-only";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { primaryNav } from "@/components/layout/header-nav-config";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";

export async function loadMegaMenuSections(): Promise<MegaMenuSection[]> {
  const upcoming = await (async () => {
    try {
      const scheduled = await getServerSalesList({ status: "scheduled", limit: 6 });
      if (scheduled.length > 0) return scheduled;
      return await getServerSalesList({ status: "active", limit: 6 });
    } catch {
      return [];
    }
  })();

  const past = await (async () => {
    try {
      return await getServerSalesList({ status: "ended", limit: 6 });
    } catch {
      return [];
    }
  })();

  const artists = await (async () => {
    try {
      const reader = await getServerArtistReader();
      const list = await reader.listFeatured();
      return list.slice(0, 6);
    } catch {
      return [];
    }
  })();

  const u = primaryNav[0];
  const p = primaryNav[1];
  const a = primaryNav[2];
  if (!u || !p || !a) {
    return [];
  }

  return [
    {
      href: u.href,
      label: u.label,
      items: upcoming.map((row) => ({
        href: `/sales/${row.sale.id}`,
        label: row.sale.title,
      })),
      viewAllHref: "/",
    },
    {
      href: p.href,
      label: p.label,
      items: past.map((row) => ({
        href: `/sales/${row.sale.id}`,
        label: row.sale.title,
      })),
      viewAllHref: "/archive",
    },
    {
      href: a.href,
      label: a.label,
      items: artists.map((artist) => ({
        href: `/artist/${artist.id}`,
        label: artist.name,
      })),
      viewAllHref: "/artist/featured",
    },
  ];
}
