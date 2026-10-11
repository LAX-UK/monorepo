import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";
import { redirect } from "next/navigation";

export function GET(request: Request) {
  const returnTo = safeRelativeReturnPath(new URL(request.url).searchParams.get("returnTo"));
  redirect(returnTo && !returnTo.startsWith("/account/post-sign-in") ? returnTo : "/account");
}
