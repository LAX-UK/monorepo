import type { DeletionPageVm } from "@/server/domain/account-deletion.vm";
import { MarketingViewAllChevron } from "@auction/marketing-ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";
import { CancelDeletionButton } from "./cancel-deletion-button.client";
import { DeleteAccountForm } from "./delete-account-form.client";

type DeleteAccountSectionProps = {
  vm: DeletionPageVm;
  /** This page: where to retry, and where to return after signing in again. */
  pagePath: string;
};

function TryAgain({ pagePath, children }: { pagePath: string; children: string }) {
  return (
    <Button asChild variant="outline" className="mt-3 min-h-11">
      <a href={pagePath}>{children}</a>
    </Button>
  );
}

/**
 * The body of Delete your account, one view per kind of answer. Nothing here decides whether
 * deletion is allowed: that is Identity's answer, shaped by buildDeletionPageVm.
 */
export function DeleteAccountSection({ vm, pagePath }: DeleteAccountSectionProps) {
  switch (vm.kind) {
    case "unavailable":
      return (
        <Alert variant="destructive">
          <AlertTitle>We can't check your account right now</AlertTitle>
          <AlertDescription>
            This is a temporary problem on our side and nothing has changed. Try again in a moment.
          </AlertDescription>
          <TryAgain pagePath={pagePath}>Try again</TryAgain>
        </Alert>
      );

    case "requested":
      return (
        <section aria-labelledby="deletion-heading" className="space-y-4">
          <div className="space-y-2">
            <h2 id="deletion-heading" className="font-headline text-lg font-medium text-on-surface">
              Your account is scheduled for deletion
            </h2>
            <p className="text-sm text-on-surface-variant">
              You asked for this on {vm.requestedOn}. We'll permanently delete your account on{" "}
              {vm.deleteOn}. Until then you can cancel and keep everything as it is.
            </p>
          </div>
          <CancelDeletionButton />
        </section>
      );

    case "blocked":
      return (
        <section aria-labelledby="deletion-heading" className="space-y-4">
          <div className="space-y-2">
            <h2 id="deletion-heading" className="font-headline text-lg font-medium text-on-surface">
              You can't delete your account yet
            </h2>
            <p className="text-sm text-on-surface-variant">
              Sort these out first, then come back to this page.
            </p>
          </div>
          {vm.groups.map((group) => (
            <InsetGroup key={group.product} label={group.label}>
              {group.blockers.map((blocker) => (
                <ListRow
                  key={blocker.code}
                  title={blocker.message}
                  {...(blocker.href
                    ? {
                        href: blocker.href,
                        trailing: <MarketingViewAllChevron className="text-on-surface-variant" />,
                      }
                    : {})}
                />
              ))}
            </InsetGroup>
          ))}
          {vm.unreachable.length > 0 ? (
            <Alert variant="warning">
              <AlertTitle>We couldn't check everything</AlertTitle>
              <AlertDescription>
                We couldn't check {vm.unreachable.join(" or ")} just now, so there may be more to
                sort out. Try again in a moment.
              </AlertDescription>
              <TryAgain pagePath={pagePath}>Check again</TryAgain>
            </Alert>
          ) : (
            <TryAgain pagePath={pagePath}>Check again</TryAgain>
          )}
        </section>
      );

    case "check_failed":
      return (
        <Alert variant="warning">
          <AlertTitle>We couldn't finish checking your account</AlertTitle>
          <AlertDescription>
            We couldn't check {vm.unreachable.join(" or ")} just now. We can't delete your account
            until we can, so nothing has changed. Try again in a moment.
          </AlertDescription>
          <TryAgain pagePath={pagePath}>Try again</TryAgain>
        </Alert>
      );

    case "eligible":
      return (
        <section aria-labelledby="deletion-heading" className="space-y-4">
          <div className="space-y-2">
            <h2 id="deletion-heading" className="font-headline text-lg font-medium text-on-surface">
              Delete your LAX account
            </h2>
            <p className="text-sm text-on-surface-variant">
              Nothing is in the way of deleting your account. Here's what happens next.
            </p>
          </div>
          <DeleteAccountForm
            phrase={vm.phrase}
            consequences={vm.consequences}
            returnTo={pagePath}
          />
        </section>
      );
  }
}
