import { requireArtistPage } from "@/lib/marketing/detail-page-existence";
import type { ReactNode } from "react";

/** Answers 404 for a artist that does not exist before the loading shell below streams. */
export default async function ArtistLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireArtistPage(id);
  return children;
}
