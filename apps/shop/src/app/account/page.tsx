import { resolveShopAccountEntryRedirect } from "@/lib/account/shop-account-routes";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

type ShopAccountEntryProps = {
  searchParams: Promise<{ returnTo?: string; merged?: string; basketMerge?: string }>;
};

/** Shop's account area is "Your orders"; this entry point signs in, merges the basket and moves on. */
export default async function ShopAccountEntry({ searchParams }: ShopAccountEntryProps) {
  const [viewer, params] = await Promise.all([loadShopViewerState(), searchParams]);
  redirect(resolveShopAccountEntryRedirect(viewer, params));
}
