import "server-only";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { primaryNav } from "@/components/layout/header-nav-config";
import { mapPublicUserToArtist } from "@/lib/data/http/artist.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import { artistPath, salePath } from "@/lib/seo/url";
import type { Sale } from "@auction/types";

type PublicSaleListQuery = {
  status?: Sale["status"];
  limit?: number;
  offset?: number;
};

function buildSalesQuery(params: PublicSaleListQuery): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 24),
    offset: String(params.offset ?? 0),
  };
  if (params.status) q.status = params.status;
  return q;
}

async function fetchMenuSales(params: PublicSaleListQuery) {
  const qs = new URLSearchParams(buildSalesQuery(params));
  const res = await fetch(`${getServerApiBase()}/sales?${qs.toString()}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
  }));
}

async function fetchMenuArtists() {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  const res = await fetch(`${getServerApiBase()}/users/public/artists?limit=6&offset=0`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    data: { id: string; name: string; image?: string | null }[];
  };
  return body.data.map(mapPublicUserToArtist);
}

export async function loadMegaMenuSections(): Promise<MegaMenuSection[]> {
  const upcoming = await (async () => {
    try {
      const scheduled = await fetchMenuSales({ status: "scheduled", limit: 6 });
      if (scheduled.length > 0) return scheduled;
      return await fetchMenuSales({ status: "active", limit: 6 });
    } catch {
      return [];
    }
  })();

  const past = await (async () => {
    try {
      return await fetchMenuSales({ status: "ended", limit: 6 });
    } catch {
      return [];
    }
  })();

  const artists = await (async () => {
    try {
      return await fetchMenuArtists();
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

  const enableArtists = process.env.NEXT_PUBLIC_ENABLE_ARTISTS !== "false";
  const core = [
    {
      href: u.href,
      label: u.label,
      items: upcoming.map((row) => ({
        href: salePath(row.sale),
        label: row.sale.title,
      })),
      viewAllHref: "/",
    },
    {
      href: p.href,
      label: p.label,
      items: past.map((row) => ({
        href: salePath(row.sale),
        label: row.sale.title,
      })),
      viewAllHref: "/archive",
    },
  ];

  if (!enableArtists || artists.length === 0) {
    return core;
  }

  return [
    ...core,
    {
      href: a.href,
      label: a.label,
      items: artists.map((artist) => ({
        href: artistPath(artist),
        label: artist.name,
      })),
      viewAllHref: "/artist/featured",
    },
  ];
}
