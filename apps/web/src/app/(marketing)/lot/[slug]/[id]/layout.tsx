import { requireLotPage } from "@/lib/marketing/lot-page-existence";
import type { ReactNode } from "react";

/** Answers 404 for a lot that does not exist before the loading shell below streams. */
export default async function LotLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireLotPage(id);
  return children;
}
