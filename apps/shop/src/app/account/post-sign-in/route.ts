import { mergeBasketOnSignIn } from "@/lib/merge-basket-on-sign-in.server";
import { markShopSilentNoticeOnStorefront } from "@/lib/silent-sign-in/cookies.server";
import { safeRelativeReturnPath } from "@auction/identity-rp";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const merge = await mergeBasketOnSignIn();

  const url = new URL(request.url);
  if (url.searchParams.get("silentNotice") === "1") {
    await markShopSilentNoticeOnStorefront();
  }
  const returnTo = safeRelativeReturnPath(url.searchParams.get("returnTo"));
  const basketMerge = merge.ok ? (merge.merged ? "merged" : "skipped") : "failed";
  if (returnTo) {
    const destination = new URL(returnTo, url.origin);
    destination.searchParams.set("basketMerge", basketMerge);
    redirect(`${destination.pathname}${destination.search}${destination.hash}`);
  }

  redirect(`/account?basketMerge=${basketMerge}&merged=1`);
}
