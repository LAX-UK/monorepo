import { redirect } from "next/navigation";

/** Legacy route — consolidated under watchlist Artists tab. */
export default async function ArtistFollowRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("section", "artists");
  if (sp.q) qs.set("q", sp.q);
  if (sp.sort) qs.set("sort", sp.sort);
  redirect(`/dashboard/watchlist?${qs.toString()}`);
}
