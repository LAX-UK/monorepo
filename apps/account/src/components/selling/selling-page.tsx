import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { type SellingPageContext, loadSellingPage } from "@/server/application/load-selling";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import type { SellingTool } from "@/server/domain/selling/selling-access";
import { SELLING_ROUTES, buildSellingTabs } from "@/server/domain/selling/selling-routes";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SellingTabs } from "./selling-parts";

type Ready = Extract<SellingPageContext, { status: "ok" }>;

/**
 * Opens a Selling page for the signed-in person. Someone signed out is sent to sign in and back;
 * someone who definitely holds no role for the page goes to Home. Both happen before anything
 * streams, so the redirects are real ones. A session store outage gets the shared notice.
 */
export async function openSellingPage(
  tool: SellingTool,
): Promise<{ ready: Ready } | { unavailable: ReactNode }> {
  const context = await loadSellingPage(tool);
  switch (context.status) {
    case "ok":
      return { ready: context };
    case "unavailable":
      return { unavailable: <AccountUnavailable retryHref={SELLING_ROUTES[tool]} /> };
    case "unsigned":
      return redirect(`/api/auth/login?returnTo=${encodeURIComponent(SELLING_ROUTES[tool])}`);
    case "forbidden":
      return redirect(ACCOUNT_ROUTES.overview);
  }
}

/** The Selling page title, its line and the tabs to the person's other seller tools. */
export function SellingPageHeader({
  ready,
  tool,
  title,
  description,
}: {
  ready: Ready;
  tool: SellingTool;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AccountPageHeader title={title} description={description} />
      <SellingTabs tabs={buildSellingTabs(ready.access, tool)} />
    </div>
  );
}
