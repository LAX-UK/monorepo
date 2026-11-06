import { requireSalePage } from "@/lib/marketing/detail-page-existence";
import type { ReactNode } from "react";

/** Answers 404 for a sale that does not exist before the loading shell below streams. */
export default async function SaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSalePage(id);
  return children;
}
