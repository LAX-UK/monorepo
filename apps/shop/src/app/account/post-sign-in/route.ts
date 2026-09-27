import { mergeBasketOnSignIn } from "@/lib/merge-basket-on-sign-in.server";
import { markShopSilentNoticeOnStorefront } from "@/lib/silent-sign-in/cookies.server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const merge = await mergeBasketOnSignIn();

  const url = new URL(request.url);
  if (url.searchParams.get("silentNotice") === "1") {
    await markShopSilentNoticeOnStorefront();
  }
  const returnTo = url.searchParams.get("returnTo");
  const mergeQuery = merge.ok
    ? merge.merged
      ? "basketMerge=merged"
      : "basketMerge=skipped"
    : "basketMerge=failed";
  if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${separator}${mergeQuery}`);
  }

  redirect(`/account?${mergeQuery}&merged=1`);
}
