import { policyRoutes } from "@/components/marketing/policy-routes";
import { LegalHub } from "@auction/marketing-ui/legal/legal-hub";
import { Skeleton } from "@auction/ui/components/skeleton";

const LINE_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;

/**
 * The policy pages while they load, in `PolicyHubLayout`'s own frame: the real policy list
 * (`LegalHub`, a sticky column on wide screens and a row of tabs on narrow ones) beside a document
 * in `LegalDocument`'s shape (breadcrumb, title, date, rule, then prose). The document is at least
 * a screen tall, as every policy page is, so the footer stays below the fold until the page
 * replaces it. The links are plain anchors, so a loading screen does not prefetch every policy.
 */
export function PolicyHubLoadingShell() {
  return (
    <div className="bg-page-bg pt-[var(--header-height)] dark:bg-background" aria-busy="true">
      <LegalHub
        label="Policies and information"
        links={policyRoutes.map((route) => ({
          href: route.href,
          label: route.sidebarLabel,
          external: true,
        }))}
      >
        <div className="lax-legal min-h-dvh">
          <div className="lax-legal__header">
            <Skeleton className="lax-legal__breadcrumb h-5 w-28 rounded-sm" />
            <Skeleton className="h-9 w-2/3 max-w-md rounded-sm lg:h-[50px]" />
            <Skeleton className="mt-3 h-5 w-40 rounded-sm" />
          </div>
          <div className="max-w-3xl space-y-4">
            {LINE_KEYS.map((key) => (
              <Skeleton key={key} className="h-5 w-full rounded-sm" />
            ))}
          </div>
        </div>
      </LegalHub>
    </div>
  );
}
